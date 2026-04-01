aws_region       = "us-east-1"
environment      = "production"
container_image  = "ghcr.io/drishti-ai/drishti-backend:latest"
container_port   = 8000

# ECS Configuration
ecs_desired_count = 3
ecs_min_capacity  = 3
ecs_max_capacity  = 20

# RDS Configuration
rds_allocated_storage = 100
rds_instance_class    = "db.t3.large"
rds_engine_version    = "15.3"

# Redis Configuration
redis_node_type        = "cache.t3.small"
redis_num_cache_nodes  = 3

# VPC Configuration
vpc_cidr = "10.0.0.0/16"

# Backup Configuration
enable_backup         = true
backup_retention_days = 30
