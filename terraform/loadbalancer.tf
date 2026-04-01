################################################################################
# Load Balancer - Application Load Balancer (ALB) and Target Groups
################################################################################

# Application Load Balancer
resource "aws_lb" "app" {
  name               = "${var.app_name}-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_1.id, aws_subnet.public_2.id]

  enable_deletion_protection = var.environment == "production" ? true : false
  enable_http2               = true
  enable_cross_zone_load_balancing = true

  tags = {
    Name = "${var.app_name}-alb-${var.environment}"
  }
}

# Target Group
resource "aws_lb_target_group" "app" {
  name        = "${var.app_name}-tg-${var.environment}"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 3
    interval            = 30
    path                = "/health"
    matcher             = "200-299"
  }

  tags = {
    Name = "${var.app_name}-tg-${var.environment}"
  }
}

# HTTP Listener (redirect to HTTPS)
resource "aws_lb_listener" "app_http" {
  load_balancer_arn = aws_lb.app.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS Listener (requires SSL certificate)
resource "aws_lb_listener" "app_https" {
  load_balancer_arn = aws_lb.app.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = aws_acm_certificate.app.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  depends_on = [aws_acm_certificate_validation.app]
}

# Self-signed certificate for testing (production should use real certificate)
# This is a placeholder - in production, generate/import a real certificate
resource "tls_private_key" "app" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_self_signed_cert" "app" {
  private_key_pem = tls_private_key.app.private_key_pem

  subject {
    common_name  = "${var.app_name}.internal"
    organization = "Drishti Operations"
  }

  validity_period_hours = 8760 # 1 year

  allowed_uses = [
    "key_encipherment",
    "digital_signature",
    "server_auth",
  ]
}

resource "aws_acm_certificate" "app" {
  private_key      = tls_private_key.app.private_key_pem
  certificate_body = tls_self_signed_cert.app.cert_pem

  tags = {
    Name = "${var.app_name}-cert-${var.environment}"
  }
}

# Certificate validation (for self-signed, immediate)
resource "aws_acm_certificate_validation" "app" {
  certificate_arn = aws_acm_certificate.app.arn
}

# Target Group Attachment (for WebSocket support)
resource "aws_lb_target_group" "app_websocket" {
  name        = "${var.app_name}-tg-ws-${var.environment}"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 3
    interval            = 30
    path                = "/health"
    matcher             = "200-299"
  }

  stickiness {
    type            = "lb_cookie"
    enabled         = true
    cookie_duration = 86400
  }

  tags = {
    Name = "${var.app_name}-tg-websocket-${var.environment}"
  }
}

# Listener Rule for WebSocket (path-based)
resource "aws_lb_listener_rule" "websocket" {
  listener_arn = aws_lb_listener.app_https.arn
  priority     = 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_websocket.arn
  }

  condition {
    path_pattern {
      values = ["/ws", "/ws/*"]
    }
  }
}

# CloudWatch Alarms for ALB
resource "aws_cloudwatch_metric_alarm" "alb_target_response_time" {
  alarm_name          = "${var.app_name}-alb-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "1.0" # seconds
  alarm_description   = "Alert when ALB target response time exceeds 1 second"

  dimensions = {
    LoadBalancer = aws_lb.app.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_host_count" {
  alarm_name          = "${var.app_name}-alb-unhealthy-hosts"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "Alert when unhealthy host count >= 1"

  dimensions = {
    LoadBalancer  = aws_lb.app.arn_suffix
    TargetGroup   = aws_lb_target_group.app.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_http_5xx" {
  alarm_name          = "${var.app_name}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Alert when 5XX error count exceeds 10 in 5 minutes"

  dimensions = {
    LoadBalancer = aws_lb.app.arn_suffix
  }
}
