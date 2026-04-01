################################################################################
# Database - RDS PostgreSQL, ElastiCache Redis, Backup and Recovery
################################################################################

# DB Subnet Group (for RDS)
resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-db-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]

  tags = {
    Name = "${var.app_name}-db-subnet-group"
  }
}

# ElastiCache Subnet Group (for Redis)
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.app_name}-redis-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]

  tags = {
    Name = "${var.app_name}-redis-subnet-group"
  }
}

# RDS PostgreSQL Database
resource "aws_db_instance" "app" {
  identifier              = "${var.app_name}-db-${var.environment}"
  allocated_storage       = var.rds_allocated_storage
  storage_type            = "gp3"
  engine                  = "postgres"
  engine_version          = var.rds_engine_version
  instance_class          = var.rds_instance_class
  db_name                 = "drishti_db"
  username                = var.db_username
  password                = var.db_password
  parameter_group_name    = aws_db_parameter_group.app.name
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  skip_final_snapshot     = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.app_name}-db-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null

  # Backup configuration
  backup_retention_period = var.backup_retention_days
  backup_window           = "03:00-04:00" # UTC
  maintenance_window      = "sun:04:00-sun:05:00" # UTC

  # Encryption
  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn

  # Enhanced monitoring
  enabled_cloudwatch_logs_exports = ["postgresql"]
  monitoring_interval              = 60
  monitoring_role_arn              = aws_iam_role.rds_monitoring.arn

  # Multi-AZ for production
  multi_az = var.environment == "production" ? true : false

  # Performance Insights (production only)
  performance_insights_enabled    = var.environment == "production" ? true : false
  performance_insights_retention_period = var.environment == "production" ? 31 : null

  # Deletion protection for production
  deletion_protection = var.environment == "production" ? true : false

  tags = {
    Name = "${var.app_name}-db-${var.environment}"
  }

  depends_on = [aws_iam_role_policy.rds_monitoring]
}

# DB Parameter Group
resource "aws_db_parameter_group" "app" {
  name   = "${var.app_name}-db-params"
  family = "postgres15"

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log queries taking > 1 second
  }

  tags = {
    Name = "${var.app_name}-db-parameter-group"
  }
}

# KMS Key for RDS Encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption (${var.app_name})"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = {
    Name = "${var.app_name}-rds-key"
  }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${var.app_name}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# IAM Role for RDS Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.app_name}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ElastiCache Redis Cluster
resource "aws_elasticache_cluster" "app" {
  cluster_id           = "${var.app_name}-redis-${var.environment}"
  engine               = "redis"
  node_type            = var.redis_node_type
  num_cache_nodes      = var.environment == "production" ? var.redis_num_cache_nodes : 1
  parameter_group_name = aws_elasticache_parameter_group.app.name
  engine_version       = "7.0"
  port                 = 6379
  parameter_group_name = "default.redis7"
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  # Automatic failover for production
  automatic_failover_enabled = var.environment == "production" ? true : false

  # Multi-AZ for production
  multi_az = var.environment == "production" ? true : false

  # Encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  # Backup for production
  snapshot_retention_limit = var.environment == "production" ? var.backup_retention_days : 0
  snapshot_window          = var.environment == "production" ? "03:00-05:00" : null

  # Maintenance window
  maintenance_window = "sun:05:00-sun:07:00" # UTC

  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
    enabled          = true
  }

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_engine_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
    enabled          = true
  }

  tags = {
    Name = "${var.app_name}-redis-${var.environment}"
  }
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "app" {
  family      = "redis7"
  name        = "${var.app_name}-redis-params"
  description = "Redis parameter group for ${var.app_name}"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru" # Evict any key using LRU when memory limit reached
  }

  tags = {
    Name = "${var.app_name}-redis-parameter-group"
  }
}

# CloudWatch Log Groups for Redis
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/${var.app_name}/slow-log"
  retention_in_days = 7

  tags = {
    Name = "${var.app_name}-redis-slow-log"
  }
}

resource "aws_cloudwatch_log_group" "redis_engine_log" {
  name              = "/aws/elasticache/${var.app_name}/engine-log"
  retention_in_days = 7

  tags = {
    Name = "${var.app_name}-redis-engine-log"
  }
}

# RDS Enhanced Monitoring Log Group
resource "aws_cloudwatch_log_group" "rds_monitoring" {
  name              = "/aws/rds/instance/${aws_db_instance.app.identifier}/monitoring"
  retention_in_days = 7

  tags = {
    Name = "${var.app_name}-rds-monitoring"
  }
}

# RDS PostgreSQL Log Group
resource "aws_cloudwatch_log_group" "rds_postgresql" {
  name              = "/aws/rds/instance/${aws_db_instance.app.identifier}/postgresql"
  retention_in_days = 30

  tags = {
    Name = "${var.app_name}-rds-postgresql-logs"
  }
}

# Database Secrets (for connection string)
resource "aws_secretsmanager_secret" "database_url" {
  name = "${var.app_name}/database-url"

  tags = {
    Name = "${var.app_name}-database-url"
  }
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.app.endpoint}/${aws_db_instance.app.db_name}?sslmode=require"
}

# Redis Secrets (for connection string)
resource "aws_secretsmanager_secret" "redis_url" {
  name = "${var.app_name}/redis-url"

  tags = {
    Name = "${var.app_name}-redis-url"
  }
}

resource "aws_secretsmanager_secret_version" "redis_url" {
  secret_id = aws_secretsmanager_secret.redis_url.id
  secret_string = "redis://${aws_elasticache_cluster.app.cache_nodes[0].address}:${aws_elasticache_cluster.app.port}?ssl=true"
}
