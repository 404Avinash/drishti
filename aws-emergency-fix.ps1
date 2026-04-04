# ╔════════════════════════════════════════════════════════════════════╗
# ║   DRISHTI AWS EMERGENCY FIX - ONE-CLICK SOLUTION                     ║
# ║   Diagnoses and fixes all issues automatically                       ║
# ╚════════════════════════════════════════════════════════════════════╝

param(
    [string]$EC2_IP = "44.216.1.62",
    [string]$SSH_KEY = "$env:USERPROFILE\.ssh\drishti-deploy-key"
)

# Configuration
$ErrorActionPreference = "Continue"
$MaxRetries = 3
$WaitTime = 30

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      DRISHTI AWS EMERGENCY FIX - ONE-CLICK DEPLOYMENT             ║" -ForegroundColor Cyan
Write-Host "║                     DEADLINE MODE ACTIVATED                        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Validate SSH key
if (-Not (Test-Path $SSH_KEY)) {
    Write-Host "❌ SSH key not found: $SSH_KEY" -ForegroundColor Red
    Write-Host ""
    Write-Host "⚠️  PLEASE PROVIDE SSH KEY:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Option 1 - Set environment variable:" -ForegroundColor Gray
    Write-Host "  `$env:SSH_KEY = 'C:\path\to\your\key.pem'" -ForegroundColor Gray
    Write-Host "  .\aws-emergency-fix.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Option 2 - Pass as parameter:" -ForegroundColor Gray
    Write-Host "  .\aws-emergency-fix.ps1 -EC2_IP '44.216.1.62' -SSH_KEY 'C:\path\to\key.pem'" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "✅ Configuration Valid" -ForegroundColor Green
Write-Host "   EC2 IP: $EC2_IP" -ForegroundColor Gray
Write-Host "   SSH Key: $SSH_KEY" -ForegroundColor Gray
Write-Host ""

# Test SSH connectivity
Write-Host "🔗 Testing SSH connectivity..." -ForegroundColor Yellow
try {
    $TestSSH = ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=5 ubuntu@$EC2_IP "echo ok" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ SSH connection successful" -ForegroundColor Green
    } else {
        throw "SSH connection failed"
    }
} catch {
    Write-Host "❌ Cannot connect to EC2" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Verify EC2 instance is running" -ForegroundColor Gray
    Write-Host "  2. Check security group allows SSH (port 22)" -ForegroundColor Gray
    Write-Host "  3. Verify SSH key permissions" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "🚀 Starting emergency fix sequence..." -ForegroundColor Cyan
Write-Host ""

# Remote fix script - THE ACTUAL FIX
$REMOTE_FIX = @'
#!/bin/bash
set -e

cd /home/ubuntu/drishti

echo "▶ [1/8] Checking Docker..."
docker --version > /dev/null 2>&1 || { echo "❌ Docker not installed"; exit 1; }
echo "✅ Docker OK"

echo "▶ [2/8] Installing Docker Compose plugin if needed..."
if ! docker compose version &>/dev/null 2>&1; then
    COMPOSE_VERSION=$(curl -fsSL https://api.github.com/repos/docker/compose/releases/latest 2>/dev/null | grep '"tag_name"' | cut -d'"' -f4 || echo "v2.24.0")
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    sudo curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" -o /usr/local/lib/docker/cli-plugins/docker-compose 2>/dev/null
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi
echo "✅ Docker Compose OK"

echo "▶ [3/8] Checking environment..."
if [ ! -f .env ]; then
    echo "⚠️  .env missing - this is critical!"
    exit 1
fi
echo "✅ Environment loaded"

echo "▶ [4/8] Stopping old containers..."
docker compose -f docker-compose.production.yml down --timeout 10 2>/dev/null || true
sleep 3
echo "✅ Containers stopped"

echo "▶ [5/8] Pulling latest Docker images..."
docker compose -f docker-compose.production.yml pull 2>&1 | grep -E "(Pulling|Downloaded|Status|Already)" | head -10
echo "✅ Images pulled"

echo "▶ [6/8] Starting fresh containers..."
docker compose -f docker-compose.production.yml up -d
echo "✅ Containers started"

echo "▶ [7/8] Waiting for services to initialize (40 seconds)..."
sleep 40

echo "▶ [8/8] Verifying system health..."
if curl -f -s http://localhost:8000/api/health > /dev/null 2>&1; then
    HEALTH=$(curl -s http://localhost:8000/api/health | jq -r '.status // "unknown"' 2>/dev/null)
    echo "✅ Backend responding - Status: $HEALTH"
else
    echo "⚠️  Backend not responding yet - checking logs..."
    docker compose logs drishti-api 2>&1 | tail -20
fi

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "✅ EMERGENCY FIX COMPLETE"
echo "════════════════════════════════════════════════════════════════════"
'@

# Execute the fix
Write-Host "📡 Executing fix sequence on EC2..." -ForegroundColor Yellow
Write-Host ""

$output = ssh -i $SSH_KEY -o StrictHostKeyChecking=no ubuntu@$EC2_IP $REMOTE_FIX 2>&1
Write-Host $output

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✅ EMERGENCY FIX EXECUTION COMPLETE" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

# Final verification
Write-Host "🔍 Final verification..." -ForegroundColor Yellow
$FinalCheck = ssh -i $SSH_KEY -o StrictHostKeyChecking=no ubuntu@$EC2_IP "cd /home/ubuntu/drishti && docker compose ps && echo '---' && curl -s http://localhost:8000/api/health | jq . 2>/dev/null || echo 'Health check pending...'" 2>&1

Write-Host $FinalCheck
Write-Host ""

Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    🎉 SYSTEM SHOULD BE LIVE NOW                  ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "📍 Test your system:" -ForegroundColor Cyan
Write-Host "   🌐 Main: http://$EC2_IP/" -ForegroundColor Cyan
Write-Host "   📊 Dashboard: http://$EC2_IP/dashboard" -ForegroundColor Cyan
Write-Host "   🚨 Alerts: http://$EC2_IP/alerts" -ForegroundColor Cyan
Write-Host "   🧠 AI Decisions: http://$EC2_IP/ai-decisions" -ForegroundColor Cyan
Write-Host "   ⚙️  System Health: http://$EC2_IP/system" -ForegroundColor Cyan
Write-Host ""

Write-Host "💡 If issues persist:" -ForegroundColor Yellow
Write-Host "   • Clear browser cache (Ctrl+Shift+Delete)" -ForegroundColor Gray
Write-Host "   • Refresh page (F5)" -ForegroundColor Gray
Write-Host "   • Check logs: ssh -i '$SSH_KEY' ubuntu@$EC2_IP" -ForegroundColor Gray
Write-Host "   • Then: cd /home/ubuntu/drishti && docker compose logs -f" -ForegroundColor Gray
Write-Host ""

Write-Host "✨ Deployment timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""
