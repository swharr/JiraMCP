# Jira MCP Server Operations Runbook

## Overview

This runbook provides comprehensive operational procedures for the Jira MCP Server, designed for DevOps engineers, SREs, and system administrators managing production deployments.

## Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Deployment Procedures](#deployment-procedures)
- [Health Monitoring](#health-monitoring)
- [Incident Response](#incident-response)
- [Maintenance Procedures](#maintenance-procedures)
- [Disaster Recovery](#disaster-recovery)
- [Performance Optimization](#performance-optimization)

## Pre-Deployment Checklist

### Infrastructure Requirements

**Minimum Resources:**
- **CPU**: 100m (0.1 vCPU) per instance
- **Memory**: 256Mi per instance
- **Storage**: 1Gi for logs and temporary files
- **Network**: Egress to Jira API (TCP/443), webhook endpoints

**Production Recommendations:**
- **CPU**: 500m-1000m per instance
- **Memory**: 512Mi-1Gi per instance
- **Replicas**: Minimum 2 for HA
- **Storage**: 5Gi with persistent volumes
- **Load Balancer**: Internal ALB/App Gateway/Cloud Load Balancer

### Security Prerequisites

**Required Certificates:**
```bash
# Verify TLS certificates
openssl s_client -connect your-jira-host:443 -servername your-jira-host
openssl s_client -connect hooks.slack.com:443 -servername hooks.slack.com

# Certificate expiry check
curl -vI https://your-jira-host 2>&1 | grep -i expire
```

**API Token Validation:**
```bash
# Test Jira API connectivity
curl -u email@company.com:api_token \
  -H "Accept: application/json" \
  "https://your-domain.atlassian.net/rest/api/3/myself"

# Expected response: 200 with user details
```

**Network Connectivity:**
```bash
# Test from deployment environment
nc -zv your-domain.atlassian.net 443
nc -zv hooks.slack.com 443
nc -zv outlook.office.com 443

# DNS resolution
nslookup your-domain.atlassian.net
dig +short your-domain.atlassian.net
```

### Environment Configuration Validation

```bash
# Validate environment variables
./scripts/validate-config.sh

# Expected environment variables
cat > validate-config.sh << 'EOF'
#!/bin/bash
set -euo pipefail

REQUIRED_VARS=(
  "JIRA_HOST"
  "JIRA_EMAIL"
  "JIRA_API_TOKEN"
  "NODE_ENV"
  "LOG_LEVEL"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    MISSING_VARS+=("$var")
  fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
  echo "ERROR: Missing required environment variables:"
  printf "   %s\n" "${MISSING_VARS[@]}"
  exit 1
fi

echo "SUCCESS: All required environment variables are set"

# Validate format
if [[ ! "$JIRA_HOST" =~ ^[a-zA-Z0-9.-]+\.atlassian\.net$ ]]; then
  echo "ERROR: Invalid JIRA_HOST format: $JIRA_HOST"
  exit 1
fi

if [[ ! "$JIRA_EMAIL" =~ ^[^@]+@[^@]+\.[^@]+$ ]]; then
  echo "ERROR: Invalid JIRA_EMAIL format: $JIRA_EMAIL"
  exit 1
fi

if [[ ${#JIRA_API_TOKEN} -lt 20 ]]; then
  echo "ERROR: JIRA_API_TOKEN appears to be too short"
  exit 1
fi

echo "SUCCESS: Environment validation passed"
EOF

chmod +x validate-config.sh
```

## Deployment Procedures

### Standard Deployment (Kubernetes)

**Step 1: Pre-deployment Verification**
```bash
# Verify cluster connectivity
kubectl cluster-info
kubectl get nodes

# Check namespace and RBAC
kubectl get ns jira-mcp || kubectl create ns jira-mcp
kubectl auth can-i create pods --namespace=jira-mcp

# Verify secrets
kubectl get secrets -n jira-mcp
kubectl describe secret jira-mcp-secrets -n jira-mcp
```

**Step 2: Deploy Application**
```bash
# Using Helm (recommended)
helm upgrade --install jira-mcp-server ./helm/jira-mcp-server \
  --namespace jira-mcp \
  --values values-production.yaml \
  --timeout 300s \
  --wait \
  --atomic

# Verify deployment
kubectl rollout status deployment/jira-mcp-server -n jira-mcp --timeout=300s

# Check pod health
kubectl get pods -n jira-mcp -l app.kubernetes.io/name=jira-mcp-server
kubectl describe pods -n jira-mcp -l app.kubernetes.io/name=jira-mcp-server
```

**Step 3: Post-deployment Validation**
```bash
# Health check validation
kubectl port-forward -n jira-mcp service/jira-mcp-server 8080:80 &
PORT_FORWARD_PID=$!

sleep 5

# Test endpoints
curl -f http://localhost:8080/health || { echo "Health check failed"; exit 1; }
curl -f http://localhost:8080/ready || { echo "Readiness check failed"; exit 1; }
curl -s http://localhost:8080/metrics | grep -q "up 1" || { echo "Metrics check failed"; exit 1; }

# Cleanup
kill $PORT_FORWARD_PID

echo "SUCCESS: Deployment validation successful"
```

### Rollback Procedures

```bash
# List releases
helm list -n jira-mcp

# Rollback to previous version
helm rollback jira-mcp-server -n jira-mcp

# Rollback to specific revision
helm rollback jira-mcp-server 3 -n jira-mcp

# Verify rollback
kubectl rollout status deployment/jira-mcp-server -n jira-mcp
```

### Blue-Green Deployment

```bash
# Deploy to staging environment first
helm upgrade --install jira-mcp-server-staging ./helm/jira-mcp-server \
  --namespace jira-mcp-staging \
  --values values-staging.yaml

# Run smoke tests
./scripts/smoke-test.sh jira-mcp-staging

# Switch traffic (update ingress/service)
kubectl patch ingress jira-mcp-ingress -n jira-mcp \
  -p '{"spec":{"rules":[{"host":"jira-mcp.company.com","http":{"paths":[{"path":"/","pathType":"Prefix","backend":{"service":{"name":"jira-mcp-server-staging","port":{"number":80}}}}]}}]}}'

# Monitor for 10 minutes, then cleanup old version
sleep 600
helm uninstall jira-mcp-server-old -n jira-mcp
```

## Health Monitoring

### Application Health Checks

**Endpoint Monitoring:**
```bash
# Health check script
cat > health-check.sh << 'EOF'
#!/bin/bash
set -euo pipefail

ENDPOINT="${1:-http://localhost:8080}"
TIMEOUT="${2:-10}"

echo "Checking application health..."

# Health endpoint
if ! curl -f -m "$TIMEOUT" "$ENDPOINT/health" > /dev/null 2>&1; then
  echo "ERROR: Health check failed"
  exit 1
fi

# Readiness endpoint
if ! curl -f -m "$TIMEOUT" "$ENDPOINT/ready" > /dev/null 2>&1; then
  echo "ERROR: Readiness check failed"
  exit 1
fi

# Metrics endpoint
if ! curl -s -m "$TIMEOUT" "$ENDPOINT/metrics" | grep -q "up 1"; then
  echo "ERROR: Metrics check failed"
  exit 1
fi

echo "SUCCESS: All health checks passed"
EOF

chmod +x health-check.sh
```

**Kubernetes Health Monitoring:**
```bash
# Pod health overview
kubectl get pods -n jira-mcp -o wide

# Detailed pod status
kubectl describe pods -n jira-mcp -l app.kubernetes.io/name=jira-mcp-server

# Resource usage
kubectl top pods -n jira-mcp

# Service endpoints
kubectl get endpoints -n jira-mcp jira-mcp-server

# Ingress status
kubectl describe ingress -n jira-mcp jira-mcp-ingress
```

### Performance Metrics

**Key Performance Indicators:**
- **Response Time**: 95th percentile < 2000ms
- **Error Rate**: < 1% over 5-minute window
- **CPU Usage**: < 70% average
- **Memory Usage**: < 80% of limit
- **Jira API Success Rate**: > 99%

**Metrics Collection:**
```bash
# Prometheus metrics
curl -s http://jira-mcp-server:8080/metrics | grep -E "(jira_api_|http_request_|process_)"

# Key metrics to monitor:
# - jira_api_request_duration_seconds
# - jira_api_request_errors_total
# - http_request_duration_seconds
# - process_cpu_seconds_total
# - process_memory_bytes
```

### Log Monitoring

**Log Aggregation Setup:**
```bash
# Fluent Bit configuration for log shipping
kubectl apply -f - << 'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: jira-mcp
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         5
        Log_Level     info
        Daemon        off
        Parsers_File  parsers.conf

    [INPUT]
        Name              tail
        Path              /var/log/containers/*jira-mcp*.log
        Parser            cri
        Tag               jira-mcp.*
        Refresh_Interval  5

    [OUTPUT]
        Name  es
        Match *
        Host  elasticsearch.logging.svc.cluster.local
        Port  9200
        Index jira-mcp-logs
EOF
```

**Log Analysis Queries:**
```bash
# Error rate analysis
grep "ERROR" /var/log/jira-mcp/*.log | wc -l

# Slow requests (>2s)
grep "duration.*[2-9][0-9][0-9][0-9]ms" /var/log/jira-mcp/*.log

# Jira API failures
grep "jira.*error\|jira.*timeout\|jira.*401\|jira.*403\|jira.*500" /var/log/jira-mcp/*.log
```

## Incident Response

### Critical Issues (P1)

**Service Completely Down:**
1. **Immediate Response (< 5 minutes)**:
   ```bash
   # Check pod status
   kubectl get pods -n jira-mcp

   # Restart pods if unhealthy
   kubectl rollout restart deployment/jira-mcp-server -n jira-mcp

   # Check recent events
   kubectl get events -n jira-mcp --sort-by='.lastTimestamp' | tail -20
   ```

2. **Investigation (< 15 minutes)**:
   ```bash
   # Check application logs
   kubectl logs -n jira-mcp deployment/jira-mcp-server --tail=100

   # Check resource constraints
   kubectl describe pods -n jira-mcp -l app.kubernetes.io/name=jira-mcp-server

   # Check network connectivity
   kubectl exec -n jira-mcp deployment/jira-mcp-server -- nc -zv your-domain.atlassian.net 443
   ```

3. **Resolution Steps**:
   ```bash
   # Scale up replicas temporarily
   kubectl scale deployment jira-mcp-server -n jira-mcp --replicas=4

   # Check resource limits
   kubectl patch deployment jira-mcp-server -n jira-mcp -p '
   {
     "spec": {
       "template": {
         "spec": {
           "containers": [{
             "name": "jira-mcp-server",
             "resources": {
               "limits": {"memory": "1Gi", "cpu": "1000m"},
               "requests": {"memory": "512Mi", "cpu": "250m"}
             }
           }]
         }
       }
     }
   }'
   ```

### High Error Rate (P2)

**Error Rate > 5%:**
```bash
# Check recent errors
kubectl logs -n jira-mcp deployment/jira-mcp-server --since=10m | grep ERROR

# Check Jira API status
curl -I https://your-domain.atlassian.net/status

# Monitor error patterns
kubectl logs -n jira-mcp deployment/jira-mcp-server --since=1h |
  grep ERROR |
  awk '{print $5}' |
  sort | uniq -c | sort -nr
```

### Performance Degradation (P3)

**Response Time > 5s:**
```bash
# Check CPU/Memory usage
kubectl top pods -n jira-mcp

# Check network latency to Jira
kubectl exec -n jira-mcp deployment/jira-mcp-server --
  curl -w "@curl-format.txt" -o /dev/null -s "https://your-domain.atlassian.net/rest/api/3/myself"

# curl-format.txt:
#      time_namelookup:  %{time_namelookup}\n
#         time_connect:  %{time_connect}\n
#      time_appconnect:  %{time_appconnect}\n
#     time_pretransfer:  %{time_pretransfer}\n
#        time_redirect:  %{time_redirect}\n
#   time_starttransfer:  %{time_starttransfer}\n
#                     ----------\n
#          time_total:  %{time_total}\n

# Scale horizontally if needed
kubectl patch hpa jira-mcp-hpa -n jira-mcp -p '{"spec":{"minReplicas":4}}'
```

### Common Error Codes and Solutions

| Error Code | Description | Resolution |
|------------|-------------|------------|
| `JIRA_AUTH_FAILED` | Jira authentication failed | Verify API token, check user permissions |
| `JIRA_TIMEOUT` | Jira API timeout | Check network connectivity, increase timeout |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Implement backoff, check rate limiting config |
| `BOARD_NOT_FOUND` | Board ID invalid | Verify board exists and user has access |
| `WEBHOOK_FAILED` | Notification delivery failed | Check webhook URLs, network connectivity |

## Maintenance Procedures

### Regular Maintenance Tasks

**Daily:**
- Monitor error rates and response times
- Check resource usage trends
- Verify backup completion
- Review security alerts

**Weekly:**
- Update dependencies (security patches)
- Review and rotate logs
- Performance trend analysis
- Capacity planning review

**Monthly:**
- Security vulnerability scan
- API token rotation
- Disaster recovery test
- Documentation review

### Update Procedures

**Security Updates:**
```bash
# Check for security vulnerabilities
npm audit

# Update dependencies
npm update

# Rebuild and test
npm run build
npm test

# Deploy with zero downtime
helm upgrade jira-mcp-server ./helm/jira-mcp-server \
  --namespace jira-mcp \
  --values values-production.yaml \
  --strategy RollingUpdate
```

**Configuration Updates:**
```bash
# Update ConfigMap
kubectl patch configmap jira-mcp-config -n jira-mcp --patch '
{
  "data": {
    "RATE_LIMIT_MAX_REQUESTS": "50"
  }
}'

# Restart deployment to pick up changes
kubectl rollout restart deployment/jira-mcp-server -n jira-mcp
```

### Certificate Management

**TLS Certificate Rotation:**
```bash
# Check certificate expiry
kubectl get certificates -n jira-mcp

# Force certificate renewal (cert-manager)
kubectl delete certificaterequest -n jira-mcp jira-mcp-tls-xxxxx

# Verify new certificate
kubectl describe certificate jira-mcp-tls -n jira-mcp
```

## Disaster Recovery

### Backup Procedures

**Configuration Backup:**
```bash
# Backup Kubernetes manifests
kubectl get all,configmap,secret,ingress,pvc -n jira-mcp -o yaml > jira-mcp-backup-$(date +%Y%m%d).yaml

# Backup Helm values
helm get values jira-mcp-server -n jira-mcp > jira-mcp-values-backup-$(date +%Y%m%d).yaml

# Store in version control or backup storage
```

**Log Backup:**
```bash
# Backup application logs
kubectl logs -n jira-mcp deployment/jira-mcp-server --since=24h > logs-backup-$(date +%Y%m%d).log

# Backup to S3/Azure Blob/GCS
aws s3 cp logs-backup-$(date +%Y%m%d).log s3://jira-mcp-backups/logs/
```

### Recovery Procedures

**Complete Cluster Failure:**
```bash
# 1. Provision new cluster
# 2. Install required operators (cert-manager, ingress, etc.)
# 3. Restore from backup
kubectl apply -f jira-mcp-backup-$(date +%Y%m%d).yaml

# 4. Verify service restoration
./scripts/smoke-test.sh
```

**Data Corruption:**
```bash
# 1. Stop application
kubectl scale deployment jira-mcp-server -n jira-mcp --replicas=0

# 2. Restore from backup
kubectl delete pvc jira-mcp-logs -n jira-mcp
kubectl apply -f pvc-backup.yaml

# 3. Restart application
kubectl scale deployment jira-mcp-server -n jira-mcp --replicas=2
```

### RTO/RPO Targets

- **Recovery Time Objective (RTO)**: 30 minutes
- **Recovery Point Objective (RPO)**: 4 hours
- **Maximum Tolerable Downtime**: 1 hour

## Performance Optimization

### Scaling Guidelines

**Horizontal Scaling Triggers:**
- CPU utilization > 70% for 5 minutes
- Memory utilization > 80% for 5 minutes
- Response time 95th percentile > 2000ms
- Error rate > 2% for 5 minutes

**Vertical Scaling Indicators:**
- Consistent high resource usage across all pods
- Memory OOMKilled events
- CPU throttling events

### Caching Optimization

```bash
# Monitor cache hit rates
kubectl logs -n jira-mcp deployment/jira-mcp-server | grep "cache" | tail -100

# Adjust cache TTL based on usage patterns
kubectl patch configmap jira-mcp-config -n jira-mcp --patch '
{
  "data": {
    "CACHE_TTL_MINUTES": "30"
  }
}'
```

### Database Connection Pooling

```bash
# Monitor connection pool metrics
curl -s http://jira-mcp-server:8080/metrics | grep pool

# Adjust pool size if needed
kubectl set env deployment/jira-mcp-server -n jira-mcp MAX_POOL_SIZE=20
```

## Security Hardening

### Regular Security Tasks

**Weekly Security Scan:**
```bash
# Container vulnerability scan
trivy image jira-mcp-server:latest --severity HIGH,CRITICAL

# Kubernetes security scan
kube-bench run --targets node,policies,managedservices

# Network policy verification
kubectl describe networkpolicy -n jira-mcp
```

**Monthly Security Review:**
```bash
# RBAC audit
kubectl auth can-i --list --as=system:serviceaccount:jira-mcp:jira-mcp-service-account

# Secret rotation
kubectl delete secret jira-mcp-secrets -n jira-mcp
kubectl create secret generic jira-mcp-secrets -n jira-mcp --from-env-file=.env.production

# Pod security policy compliance
kubectl get psp -o yaml | grep -A 10 -B 10 jira-mcp
```

### Compliance Verification

**SOC 2 Compliance Checklist:**
- [ ] Encryption in transit (TLS 1.2+)
- [ ] Encryption at rest for secrets
- [ ] Access logging enabled
- [ ] Regular security assessments
- [ ] Incident response procedures documented
- [ ] Data retention policies implemented

**GDPR Compliance:**
- [ ] Data processing lawful basis documented
- [ ] Personal data inventory maintained
- [ ] Data subject rights procedures
- [ ] Data breach notification process
- [ ] Privacy by design implementation

## Emergency Contacts

### On-Call Escalation

1. **L1 Support**: DevOps Team (Slack: #devops-oncall)
2. **L2 Support**: Platform Engineering (Email: platform-team@company.com)
3. **L3 Support**: Application Owners (Phone: +1-555-ONCALL)

### External Dependencies

- **Atlassian Support**: support.atlassian.com
- **Cloud Provider Support**:
  - AWS: +1-206-266-4064
  - Azure: +1-800-642-7676
  - GCP: +1-650-253-0000

---

**Document Version**: 1.0
**Last Updated**: $(date +%Y-%m-%d)
**Owner**: DevOps Team
**Review Cycle**: Monthly