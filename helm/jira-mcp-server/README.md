# Jira MCP Server Helm Chart

A Helm chart for deploying the Jira MCP Server on Kubernetes across multiple cloud platforms.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- PV provisioner support in the underlying infrastructure (optional)

## Installation

### Quick Start

```bash
# Add the repository (replace with actual repository)
helm repo add jira-mcp https://your-org.github.io/helm-charts
helm repo update

# Install with default values
helm install jira-mcp-server jira-mcp/jira-mcp-server

# Install with custom values
helm install jira-mcp-server jira-mcp/jira-mcp-server -f my-values.yaml
```

### Cloud-Specific Installation

#### AWS EKS
```bash
helm install jira-mcp-server ./helm/jira-mcp-server \
  -f ./helm/jira-mcp-server/values-aws.yaml \
  --set cloudProvider.aws.roleArn="arn:aws:iam::ACCOUNT_ID:role/jira-mcp-role" \
  --set secrets.jiraHost="your-domain.atlassian.net" \
  --set secrets.jiraEmail="user@company.com" \
  --set secrets.jiraApiToken="your-api-token"
```

#### Azure AKS
```bash
helm install jira-mcp-server ./helm/jira-mcp-server \
  -f ./helm/jira-mcp-server/values-azure.yaml \
  --set global.imageRegistry="yourregistry.azurecr.io" \
  --set secrets.jiraHost="your-domain.atlassian.net" \
  --set secrets.jiraEmail="user@company.com" \
  --set secrets.jiraApiToken="your-api-token"
```

#### Google GKE
```bash
helm install jira-mcp-server ./helm/jira-mcp-server \
  -f ./helm/jira-mcp-server/values-gcp.yaml \
  --set cloudProvider.gcp.projectId="your-project-id" \
  --set global.imageRegistry="gcr.io/your-project-id" \
  --set secrets.jiraHost="your-domain.atlassian.net" \
  --set secrets.jiraEmail="user@company.com" \
  --set secrets.jiraApiToken="your-api-token"
```

## Configuration

### Required Values

| Parameter | Description | Example |
|-----------|-------------|---------|
| `secrets.jiraHost` | Jira instance hostname | `company.atlassian.net` |
| `secrets.jiraEmail` | Jira user email | `user@company.com` |
| `secrets.jiraApiToken` | Jira API token | `ATATT3x...` |

### Common Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of pod replicas | `2` |
| `image.repository` | Image repository | `jira-mcp-server` |
| `image.tag` | Image tag | `latest` |
| `service.type` | Service type | `ClusterIP` |
| `service.port` | Service port | `80` |
| `ingress.enabled` | Enable ingress | `false` |
| `autoscaling.enabled` | Enable HPA | `false` |
| `networkPolicy.enabled` | Enable network policy | `false` |

### Cloud Provider Configuration

#### AWS
```yaml
cloudProvider:
  provider: aws
  aws:
    clusterName: "my-eks-cluster"
    roleArn: "arn:aws:iam::123456789012:role/jira-mcp-role"
    alb:
      enabled: true
      scheme: internal
      certificateArn: "arn:aws:acm:us-west-2:123456789012:certificate/abc123"
```

#### Azure
```yaml
cloudProvider:
  provider: azure
  azure:
    clusterName: "my-aks-cluster"
    resourceGroup: "my-resource-group"
    appGateway:
      enabled: true
      resourceGroup: "my-resource-group"
      name: "my-app-gateway"
```

#### GCP
```yaml
cloudProvider:
  provider: gcp
  gcp:
    clusterName: "my-gke-cluster"
    projectId: "my-project-id"
    workloadIdentity:
      enabled: true
      serviceAccount: "jira-mcp@my-project-id.iam.gserviceaccount.com"
    cloudArmor:
      enabled: true
      policyName: "jira-mcp-security-policy"
```

### Security Configuration

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  runAsGroup: 1001
  fsGroup: 1001

containerSecurityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 1001
  capabilities:
    drop:
      - ALL

networkPolicy:
  enabled: true
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-system
      ports:
        - protocol: TCP
          port: 8080
```

### Monitoring Configuration

```yaml
monitoring:
  serviceMonitor:
    enabled: true
    namespace: monitoring
    interval: 30s
    scrapeTimeout: 10s
    labels:
      app: jira-mcp-server

podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8080"
  prometheus.io/path: "/metrics"
```

## Upgrades

```bash
# Upgrade to new version
helm upgrade jira-mcp-server ./helm/jira-mcp-server

# Upgrade with new values
helm upgrade jira-mcp-server ./helm/jira-mcp-server -f new-values.yaml

# Rollback to previous version
helm rollback jira-mcp-server 1
```

## Uninstallation

```bash
helm uninstall jira-mcp-server
```

## Troubleshooting

### Check Pod Status
```bash
kubectl get pods -l app.kubernetes.io/name=jira-mcp-server
kubectl describe pod -l app.kubernetes.io/name=jira-mcp-server
kubectl logs -l app.kubernetes.io/name=jira-mcp-server
```

### Check Service and Ingress
```bash
kubectl get svc -l app.kubernetes.io/name=jira-mcp-server
kubectl get ingress -l app.kubernetes.io/name=jira-mcp-server
```

### Test Health Endpoints
```bash
# Port forward to test locally
kubectl port-forward svc/jira-mcp-server 8080:80

# Test health endpoints
curl http://localhost:8080/health
curl http://localhost:8080/ready
curl http://localhost:8080/metrics
```

### Common Issues

1. **ImagePullBackOff**: Check image repository and tag
2. **CrashLoopBackOff**: Check application logs and environment variables
3. **Ingress not working**: Verify ingress controller and annotations
4. **Health checks failing**: Check application startup time and endpoints

## Development

### Local Testing

```bash
# Test template rendering
helm template jira-mcp-server ./helm/jira-mcp-server -f values-test.yaml

# Dry run installation
helm install jira-mcp-server ./helm/jira-mcp-server --dry-run --debug

# Lint the chart
helm lint ./helm/jira-mcp-server
```

### Chart Validation

```bash
# Install chart testing tools
helm plugin install https://github.com/helm-unittest/helm-unittest

# Run tests
helm unittest ./helm/jira-mcp-server
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Test your changes thoroughly
4. Submit a pull request

## License

This Helm chart is licensed under the MIT License.