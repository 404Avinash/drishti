################################################################################
# Outputs - Infrastructure Output Values
################################################################################

# VPC Outputs
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC ID"
}

output "public_subnet_1_id" {
  value       = aws_subnet.public_1.id
  description = "Public Subnet 1 ID"
}

output "public_subnet_2_id" {
  value       = aws_subnet.public_2.id
  description = "Public Subnet 2 ID"
}

output "private_subnet_1_id" {
  value       = aws_subnet.private_1.id
  description = "Private Subnet 1 ID"
}

output "private_subnet_2_id" {
  value       = aws_subnet.private_2.id
  description = "Private Subnet 2 ID"
}

# ALB Outputs
output "alb_dns_name" {
  value       = aws_lb.app.dns_name
  description = "ALB DNS name"
}

output "alb_arn" {
  value       = aws_lb.app.arn
  description = "ALB ARN"
}

output "alb_zone_id" {
  value       = aws_lb.app.zone_id
  description = "ALB Zone ID"
}

output "target_group_arn" {
  value       = aws_lb_target_group.app.arn
  description = "Target Group ARN"
}

# ECS Outputs
output "ecs_cluster_name" {
  value       = aws_ecs_cluster.main.name
  description = "ECS Cluster Name"
}

output "ecs_cluster_arn" {
  value       = aws_ecs_cluster.main.arn
  description = "ECS Cluster ARN"
}

output "ecs_service_name" {
  value       = aws_ecs_service.app.name
  description = "ECS Service Name"
}

output "ecs_task_definition_arn" {
  value       = aws_ecs_task_definition.app.arn
  description = "ECS Task Definition ARN"
}

output "ecs_log_group" {
  value       = aws_cloudwatch_log_group.ecs.name
  description = "ECS CloudWatch Log Group"
}

# RDS Outputs
output "rds_endpoint" {
  value       = aws_db_instance.app.endpoint
  description = "RDS Database Endpoint"
  sensitive   = false
}

output "rds_address" {
  value       = aws_db_instance.app.address
  description = "RDS Database Address"
  sensitive   = false
}

output "rds_port" {
  value       = aws_db_instance.app.port
  description = "RDS Database Port"
}

output "rds_database_name" {
  value       = aws_db_instance.app.db_name
  description = "RDS Database Name"
}

output "rds_master_username" {
  value       = aws_db_instance.app.username
  description = "RDS Master Username"
  sensitive   = true
}

output "rds_arn" {
  value       = aws_db_instance.app.arn
  description = "RDS Instance ARN"
}

# Redis Outputs
output "redis_endpoint" {
  value       = aws_elasticache_cluster.app.cache_nodes[0].address
  description = "Redis Cluster Primary Endpoint"
}

output "redis_port" {
  value       = aws_elasticache_cluster.app.port
  description = "Redis Cluster Port"
}

output "redis_cluster_id" {
  value       = aws_elasticache_cluster.app.cluster_id
  description = "Redis Cluster ID"
}

# Secrets Manager Outputs
output "database_url_secret_arn" {
  value       = aws_secretsmanager_secret.database_url.arn
  description = "Database URL Secret ARN"
}

output "redis_url_secret_arn" {
  value       = aws_secretsmanager_secret.redis_url.arn
  description = "Redis URL Secret ARN"
}

# Security Group Outputs
output "alb_security_group_id" {
  value       = aws_security_group.alb.id
  description = "ALB Security Group ID"
}

output "ecs_tasks_security_group_id" {
  value       = aws_security_group.ecs_tasks.id
  description = "ECS Tasks Security Group ID"
}

output "rds_security_group_id" {
  value       = aws_security_group.rds.id
  description = "RDS Security Group ID"
}

output "redis_security_group_id" {
  value       = aws_security_group.redis.id
  description = "Redis Security Group ID"
}

# CloudTrail Outputs
output "cloudtrail_s3_bucket" {
  value       = aws_s3_bucket.cloudtrail.id
  description = "CloudTrail S3 Bucket Name"
}

output "cloudtrail_arn" {
  value       = aws_cloudtrail.drishti.arn
  description = "CloudTrail ARN"
}

# Regional Info
output "aws_region" {
  value       = var.aws_region
  description = "AWS Region"
}

output "environment" {
  value       = var.environment
  description = "Environment"
}

# Application Info
output "app_name" {
  value       = var.app_name
  description = "Application Name"
}

output "application_url" {
  value       = "https://${aws_lb.app.dns_name}"
  description = "Application URL (ALB DNS)"
}

# Summary Output
output "infrastructure_summary" {
  value = {
    app_url        = "https://${aws_lb.app.dns_name}"
    ecs_cluster    = aws_ecs_cluster.main.name
    rds_endpoint   = aws_db_instance.app.endpoint
    redis_endpoint = "${aws_elasticache_cluster.app.cache_nodes[0].address}:${aws_elasticache_cluster.app.port}"
    environment    = var.environment
    region         = var.aws_region
  }
  description = "Infrastructure summary"
}
