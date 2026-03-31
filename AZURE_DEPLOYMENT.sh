#!/bin/bash
# DRISHTI Phase 5: Azure AKS Deployment Script
# Run this in Azure Cloud Shell: https://shell.azure.com
# This script handles: Resource Group → ACR → AKS → Helm Deploy

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  DRISHTI PHASE 5: Azure AKS Deployment                    ║"
echo "║  Creating: Resource Group → ACR → AKS → PostgreSQL → Helm  ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# === CONFIGURATION ===
RESOURCE_GROUP="drishti-rg"
LOCATION="eastus"  # Change to closer region if needed
ACR_NAME="drishtiregistry"
AKS_CLUSTER="drishti-aks"
AKS_NODES=3
POSTGRES_SERVER="drishti-postgres-$(date +%s)"
NAMESPACE="drishti"

echo "[1/10] Checking prerequisites..."
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not found. Use: https://shell.azure.com (already includes az)"
    exit 1
fi
if ! command -v kubectl &> /dev/null; then
    echo "⚠️  kubectl not found, installing..."
    az aks install-cli
fi
if ! command -v helm &> /dev/null; then
    echo "⚠️  helm not found, installing..."
    curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi
echo "✅ Prerequisites OK"
echo ""

# === STEP 1: Create Resource Group ===
echo "[2/10] Creating Azure Resource Group: $RESOURCE_GROUP in $LOCATION..."
az group create --name $RESOURCE_GROUP --location $LOCATION
echo "✅ Resource group created"
echo ""

# === STEP 2: Create Azure Container Registry ===
echo "[3/10] Creating Azure Container Registry: $ACR_NAME..."
az acr create \
    --resource-group $RESOURCE_GROUP \
    --name $ACR_NAME \
    --sku Basic \
    --admin-enabled true
echo "✅ Container Registry created"
ACR_URL=$(az acr show --resource-group $RESOURCE_GROUP --name $ACR_NAME --query loginServer -o tsv)
echo "   Registry URL: $ACR_URL"
echo ""

# === STEP 3: Build and Push Docker Image ===
echo "[4/10] Logging into Azure Container Registry..."
az acr login --name $ACR_NAME
echo "✅ Logged into ACR"
echo ""

echo "[5/10] Cloning DRISHTI repository (if not already cloned)..."
if [ ! -d "drishti" ]; then
    git clone https://github.com/404Avinash/drishti.git
else
    cd drishti && git pull && cd ..
fi
cd drishti
echo "✅ Repository ready"
echo ""

echo "[6/10] Building Docker image and pushing to ACR..."
echo "   Building: $ACR_URL/drishti:latest"
az acr build --registry $ACR_NAME --image drishti:latest .
echo "✅ Docker image pushed to ACR"
echo ""

# === STEP 4: Create AKS Cluster ===
echo "[7/10] Creating AKS cluster: $AKS_CLUSTER ($AKS_NODES nodes)..."
echo "   This may take 5-10 minutes, please wait..."
az aks create \
    --resource-group $RESOURCE_GROUP \
    --name $AKS_CLUSTER \
    --node-count $AKS_NODES \
    --vm-set-type VirtualMachineScaleSets \
    --load-balancer-sku standard \
    --attach-acr $ACR_NAME \
    --enable-managed-identity \
    --network-plugin azure \
    --no-wait  # Don't wait, show progress separately

echo "📍 AKS creation started (continues in background)..."
echo ""

echo "[8/10] Waiting for AKS cluster to be ready (this takes ~5-10 min)..."
az aks wait --created --resource-group $RESOURCE_GROUP --name $AKS_CLUSTER
echo "✅ AKS cluster ready"
echo ""

# === STEP 5: Get AKS Credentials ===
echo "[9/10] Configuring kubectl for AKS cluster..."
az aks get-credentials \
    --resource-group $RESOURCE_GROUP \
    --name $AKS_CLUSTER \
    --overwrite-existing
echo "✅ kubectl configured"
echo ""

# Verify cluster access
echo "Verifying cluster access..."
kubectl cluster-info
echo ""

# === STEP 6: Create Namespace ===
echo "Creating Kubernetes namespace: $NAMESPACE..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
echo "✅ Namespace ready"
echo ""

# === STEP 7: Deploy PostgreSQL (Azure Database) ===
echo "Creating Azure Database for PostgreSQL..."
echo "⏳ This may take 5-10 minutes..."
az postgres server create \
    --resource-group $RESOURCE_GROUP \
    --name $POSTGRES_SERVER \
    --location $LOCATION \
    --admin-user drishti \
    --admin-password "DrishtiSafe@2026" \
    --sku-name B_Gen5_2 \
    --storage-size 51200 \
    --no-wait  # Background process

echo "✅ PostgreSQL creation started (background)"
echo ""

# === STEP 8: Create ConfigMaps and Secrets ===
echo "Creating Kubernetes ConfigMaps and Secrets..."

kubectl create configmap drishti-config \
    --from-literal=STREAMING_BACKEND=kafka \
    --from-literal=BATCH_SIZE=100 \
    --from-literal=MAX_WORKERS=4 \
    --from-literal=LOG_LEVEL=INFO \
    -n $NAMESPACE \
    --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic drishti-secrets \
    --from-literal=DB_USER=drishti \
    --from-literal=DB_PASSWORD=DrishtiSafe@2026 \
    --from-literal=DB_HOST=$POSTGRES_SERVER.postgres.database.azure.com \
    --from-literal=DB_PORT=5432 \
    --from-literal=DB_NAME=drishti \
    -n $NAMESPACE \
    --dry-run=client -o yaml | kubectl apply -f -

echo "✅ ConfigMaps and Secrets created"
echo ""

# === STEP 9: Deploy with Helm ===
echo "[10/10] Deploying DRISHTI with Helm Charts..."
echo "Creating Helm values for Azure..."

cat > /tmp/azure-values.yaml <<EOF
image:
  repository: $ACR_URL/drishti
  tag: latest
  pullPolicy: Always

replicaCount: 3

service:
  type: LoadBalancer
  port: 80
  targetPort: 8000

ingress:
  enabled: false

resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"

database:
  enabled: true
  host: $POSTGRES_SERVER.postgres.database.azure.com
  user: drishti
  password: DrishtiSafe@2026
EOF

helm install drishti deployment/helm \
    -n $NAMESPACE \
    -f /tmp/azure-values.yaml \
    --wait

echo "✅ Helm deployment complete"
echo ""

# === FINAL STATUS ===
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ DRISHTI DEPLOYMENT SUCCESSFUL!                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 DEPLOYMENT SUMMARY:"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Region: $LOCATION"
echo "   AKS Cluster: $AKS_CLUSTER ($AKS_NODES nodes)"
echo "   Container Registry: $ACR_URL"
echo "   Database: $POSTGRES_SERVER.postgres.database.azure.com"
echo "   Namespace: $NAMESPACE"
echo ""

echo "🔗 GET SERVICE ENDPOINT:"
echo "   kubectl get service drishti-api-service -n $NAMESPACE"
echo ""

echo "📈 VIEW PODS:"
echo "   kubectl get pods -n $NAMESPACE"
echo ""

echo "📝 VIEW LOGS:"
echo "   kubectl logs -f deployment/drishti-api -n $NAMESPACE"
echo ""

echo "🌐 PORT FORWARD (if using LoadBalancer):"
EXTERNAL_IP=$(kubectl get svc drishti-api-service -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "pending")
if [ "$EXTERNAL_IP" != "pending" ]; then
    echo "   External IP: http://$EXTERNAL_IP:8000"
else
    echo "   ⏳ External IP still pending, check with:"
    echo "   kubectl get svc drishti-api-service -n $NAMESPACE"
fi
echo ""

echo "🗑️  CLEANUP (when done):"
echo "   az group delete --name $RESOURCE_GROUP --yes --no-wait"
echo ""

echo "✨ NEXT STEPS:"
echo "   1. Wait for External IP to be assigned"
echo "   2. Visit http://EXTERNAL_IP:8000 to access dashboard"
echo "   3. Monitor pods: kubectl get pods -n drishti -w"
echo "   4. Check logs: kubectl logs -f deployment/drishti-api -n drishti"
echo ""
