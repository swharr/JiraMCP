# Cloud Deployment Guide

This guide covers deploying the Jira MCP Server across major cloud platforms: Azure Kubernetes Service (AKS), Google Kubernetes Engine (GKE), and Amazon EKS.

## Platform Comparison

| Feature | AKS | GKE | EKS |
|---------|-----|-----|-----|
| **Managed Certificates** | Application Gateway | Google-managed SSL | AWS Certificate Manager |
| **Load Balancer** | Azure Load Balancer | Cloud Load Balancing | AWS ALB/NLB |
| **Security** | Azure Policy | Cloud Armor | AWS WAF |
| **Secrets Management** | Azure Key Vault | Secret Manager | AWS Secrets Manager |
| **Monitoring** | Azure Monitor | Cloud Monitoring | CloudWatch |
| **Auto-scaling** | VMSS | GKE Autopilot | EKS Managed Node Groups |

## Azure Kubernetes Service (AKS)

### Prerequisites

```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login

# Install kubectl
az aks install-cli
```

### 1. Create AKS Cluster

```bash
# Set variables
RESOURCE_GROUP="jira-mcp-rg"
CLUSTER_NAME="jira-mcp-aks"
LOCATION="eastus"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create AKS cluster with Application Gateway Ingress Controller
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $CLUSTER_NAME \
  --node-count 3 \
  --node-vm-size Standard_D2s_v3 \
  --enable-addons ingress-appgw \
  --appgw-name jira-mcp-appgw \
  --appgw-subnet-cidr "10.2.0.0/16" \
  --enable-managed-identity \
  --enable-cluster-autoscaler \
  --min-count 2 \
  --max-count 10
```

### 2. Configure kubectl

```bash
az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME
```

### 3. Deploy Application

```bash
# Apply all manifests
kubectl apply -f deploy/aks/

# Update secrets with actual values
kubectl create secret generic jira-mcp-secrets \
  --namespace=jira-mcp \
  --from-literal=JIRA_HOST="your-domain.atlassian.net" \
  --from-literal=JIRA_EMAIL="user@example.com" \
  --from-literal=JIRA_API_TOKEN="your-api-token" \
  --from-literal=SLACK_WEBHOOK_URL="https://hooks.slack.com/..." \
  --from-literal=TEAMS_WEBHOOK_URL="https://outlook.office.com/..."
```

### 4. Configure Application Gateway

```bash
# Get Application Gateway details
az network application-gateway list --resource-group $RESOURCE_GROUP

# Configure custom domain (optional)
az network dns record-set cname set-record \
  --resource-group $RESOURCE_GROUP \
  --zone-name yourdomain.com \
  --record-set-name jira-mcp \
  --cname jira-mcp-appgw.eastus.cloudapp.azure.com
```

### 5. Enable Azure Key Vault Integration

```bash
# Create Key Vault
az keyvault create \
  --name jira-mcp-kv \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Store secrets
az keyvault secret set --vault-name jira-mcp-kv --name "jira-api-token" --value "your-token"
az keyvault secret set --vault-name jira-mcp-kv --name "slack-webhook" --value "your-webhook"

# Install Secret Store CSI Driver
kubectl apply -f https://raw.githubusercontent.com/Azure/secrets-store-csi-driver-provider-azure/master/deployment/provider-azure-installer.yaml
```

## Google Kubernetes Engine (GKE)

### Prerequisites

```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Initialize gcloud
gcloud init

# Install kubectl
gcloud components install kubectl
```

### 1. Create GKE Cluster

```bash
# Set variables
PROJECT_ID="your-project-id"
CLUSTER_NAME="jira-mcp-gke"
ZONE="us-central1-a"

# Enable APIs
gcloud services enable container.googleapis.com
gcloud services enable compute.googleapis.com

# Create GKE cluster with Autopilot (recommended for production)
gcloud container clusters create-auto $CLUSTER_NAME \
  --region=us-central1 \
  --project=$PROJECT_ID

# Alternative: Standard cluster with more control
gcloud container clusters create $CLUSTER_NAME \
  --zone=$ZONE \
  --num-nodes=3 \
  --machine-type=e2-standard-2 \
  --enable-autoscaling \
  --min-nodes=2 \
  --max-nodes=10 \
  --enable-autorepair \
  --enable-autoupgrade \
  --addons=HorizontalPodAutoscaling,HttpLoadBalancing \
  --project=$PROJECT_ID
```

### 2. Configure kubectl

```bash
gcloud container clusters get-credentials $CLUSTER_NAME --zone=$ZONE --project=$PROJECT_ID
```

### 3. Create Service Account and IAM

```bash
# Create Google Service Account
gcloud iam service-accounts create jira-mcp-sa \
  --display-name="Jira MCP Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:jira-mcp-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Enable Workload Identity
gcloud iam service-accounts add-iam-policy-binding \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:$PROJECT_ID.svc.id.goog[jira-mcp/jira-mcp-service-account]" \
  jira-mcp-sa@$PROJECT_ID.iam.gserviceaccount.com
```

### 4. Deploy Application

```bash
# Update PROJECT_ID in deployment manifests
sed -i "s/PROJECT_ID/$PROJECT_ID/g" deploy/gke/*.yaml

# Apply all manifests
kubectl apply -f deploy/gke/

# Create secrets
kubectl create secret generic jira-mcp-secrets \
  --namespace=jira-mcp \
  --from-literal=JIRA_HOST="your-domain.atlassian.net" \
  --from-literal=JIRA_EMAIL="user@example.com" \
  --from-literal=JIRA_API_TOKEN="your-api-token" \
  --from-literal=SLACK_WEBHOOK_URL="https://hooks.slack.com/..." \
  --from-literal=TEAMS_WEBHOOK_URL="https://outlook.office.com/..."
```

### 5. Configure Google Cloud Armor (Security)

```bash
# Create security policy
gcloud compute security-policies create jira-mcp-armor-policy \
  --description "Security policy for Jira MCP Server"

# Add rate limiting
gcloud compute security-policies rules create 1000 \
  --security-policy jira-mcp-armor-policy \
  --expression "true" \
  --action "rate-based-ban" \
  --rate-limit-threshold-count 100 \
  --rate-limit-threshold-interval-sec 60 \
  --ban-duration-sec 600 \
  --conform-action allow \
  --exceed-action deny-429 \
  --enforce-on-key IP

# Add XSS protection
gcloud compute security-policies rules create 4000 \
  --security-policy jira-mcp-armor-policy \
  --expression "evaluatePreconfiguredExpr('xss-stable')" \
  --action deny-403
```

### 6. Reserve Static IP and Configure DNS

```bash
# Reserve static IP
gcloud compute addresses create jira-mcp-ip --global

# Get the IP
gcloud compute addresses describe jira-mcp-ip --global

# Update DNS records to point to this IP
```

## Amazon EKS (Using existing configuration)

The EKS deployment uses the existing configuration in `deploy/eks/`. See the main deployment guide for EKS-specific instructions.

## Cloud-Specific Features

### AKS Specific Features

1. **Azure Application Gateway Integration**
   - SSL termination with Azure certificates
   - Web Application Firewall (WAF)
   - URL-based routing

2. **Azure Key Vault Integration**
   ```yaml
   volumes:
   - name: secrets-store-inline
     csi:
       driver: secrets-store.csi.k8s.io
       readOnly: true
       volumeAttributes:
         secretProviderClass: "azure-kvname"
   ```

3. **Azure Monitor Integration**
   ```yaml
   annotations:
     prometheus.io/scrape: "true"
     prometheus.io/port: "8080"
   ```

### GKE Specific Features

1. **Google-Managed SSL Certificates**
   ```yaml
   metadata:
     annotations:
       networking.gke.io/managed-certificates: "jira-mcp-ssl-cert"
   ```

2. **Workload Identity**
   ```yaml
   metadata:
     annotations:
       iam.gke.io/gcp-service-account: jira-mcp@PROJECT_ID.iam.gserviceaccount.com
   ```

3. **Cloud Armor Security**
   ```yaml
   metadata:
     annotations:
       cloud.google.com/armor-config: '{"jira-mcp-security-policy": "jira-mcp-armor-policy"}'
   ```

## Security Best Practices

### Network Security

1. **Private Clusters** (Recommended for production)
   ```bash
   # AKS
   az aks create --enable-private-cluster

   # GKE
   gcloud container clusters create --enable-private-nodes

   # EKS
   aws eks create-cluster --resources-vpc-config privateSubnetIds=subnet-xxx
   ```

2. **Network Policies**
   - Applied automatically via `network-policy.yaml`
   - Restricts pod-to-pod communication
   - Allows only necessary ingress/egress

3. **Pod Security Standards**
   ```yaml
   securityContext:
     runAsNonRoot: true
     runAsUser: 1001
     allowPrivilegeEscalation: false
     readOnlyRootFilesystem: true
   ```

### Secrets Management

1. **Cloud-Native Solutions**
   - **AKS**: Azure Key Vault + CSI Secret Store Driver
   - **GKE**: Google Secret Manager + Workload Identity
   - **EKS**: AWS Secrets Manager + External Secrets Operator

2. **Rotation Strategy**
   ```bash
   # Automated secret rotation every 90 days
   # Implement using cloud-specific rotation policies
   ```

## Monitoring and Observability

### Metrics Collection

1. **Prometheus Integration**
   ```yaml
   annotations:
     prometheus.io/scrape: "true"
     prometheus.io/port: "8080"
     prometheus.io/path: "/metrics"
   ```

2. **Cloud-Native Monitoring**
   - **AKS**: Azure Monitor for containers
   - **GKE**: Google Cloud Monitoring
   - **EKS**: Amazon CloudWatch Container Insights

### Logging

1. **Structured Logging**
   - JSON format for cloud log aggregation
   - Correlation IDs for request tracing
   - Security event logging

2. **Log Shipping**
   ```yaml
   # Fluentd/Fluent Bit sidecar for log shipping
   - name: log-shipper
     image: fluent/fluent-bit:latest
   ```

## Scaling Configuration

### Horizontal Pod Autoscaler (HPA)

```yaml
spec:
  minReplicas: 2
  maxReplicas: 20  # GKE supports higher limits
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Cluster Autoscaler

- **AKS**: VMSS-based autoscaling
- **GKE**: Node auto-provisioning
- **EKS**: Managed node groups

## Cost Optimization

### Resource Allocation

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Spot/Preemptible Instances

- **AKS**: Spot node pools
- **GKE**: Preemptible instances
- **EKS**: Spot instances

## Troubleshooting

### Common Issues

1. **Ingress Not Working**
   ```bash
   # Check ingress controller logs
   kubectl logs -n ingress-system deployment/ingress-controller

   # Verify SSL certificates
   kubectl get managedcertificate -n jira-mcp
   ```

2. **Pod Startup Issues**
   ```bash
   # Check pod events
   kubectl describe pod -n jira-mcp -l app=jira-mcp-server

   # Check secrets
   kubectl get secrets -n jira-mcp
   ```

3. **Network Connectivity**
   ```bash
   # Test external connectivity
   kubectl run test-pod --image=busybox --rm -it -- nslookup your-domain.atlassian.net
   ```

### Health Checks

```bash
# Check application health
kubectl get pods -n jira-mcp
kubectl logs -n jira-mcp deployment/jira-mcp-server

# Test health endpoints
kubectl port-forward -n jira-mcp service/jira-mcp-service 8080:80
curl http://localhost:8080/health
```

## Backup and Disaster Recovery

### Configuration Backup

```bash
# Export cluster configuration
kubectl get all -n jira-mcp -o yaml > jira-mcp-backup.yaml

# Backup secrets (encrypted)
kubectl get secrets -n jira-mcp -o yaml > secrets-backup.yaml
```

### Multi-Region Deployment

For high availability, deploy across multiple regions using the same manifests with region-specific configurations.

## Next Steps

1. Configure monitoring and alerting
2. Set up automated CI/CD pipelines for deployments
3. Implement backup and disaster recovery procedures
4. Configure log aggregation and analysis
5. Set up security scanning and compliance checks