# Jira MCP Server Troubleshooting Guide

## Overview

This guide provides systematic troubleshooting procedures for the Jira MCP Server, organized by symptom category with specific error codes, diagnostic commands, and resolution steps.

## Table of Contents

- [Quick Diagnostic Commands](#quick-diagnostic-commands)
- [Application Startup Issues](#application-startup-issues)
- [Jira API Connection Problems](#jira-api-connection-problems)
- [Authentication & Authorization](#authentication--authorization)
- [Performance Issues](#performance-issues)
- [Network Connectivity](#network-connectivity)
- [Container & Kubernetes Issues](#container--kubernetes-issues)
- [Microsoft Copilot Integration Issues](#microsoft-copilot-integration-issues)
- [Monitoring & Logging Issues](#monitoring--logging-issues)

## Quick Diagnostic Commands

### Health Check Suite
```bash
#!/bin/bash
# Quick diagnostic script - save as diagnose.sh

echo " Jira MCP Server Diagnostics"
echo "=============================="

# Application health
echo " Application Health:"
kubectl get pods -n jira-mcp -l app.kubernetes.io/name=jira-mcp-server
echo ""

# Resource usage
echo " Resource Usage:"
kubectl top pods -n jira-mcp -l app.kubernetes.io/name=jira-mcp-server 2>/dev/null || echo "Metrics server not available"
echo ""

# Recent errors
echo " Recent Errors (last 5 minutes):"
kubectl logs -n jira-mcp deployment/jira-mcp-server --since=5m | grep -i error | tail -5
echo ""

# Network connectivity
echo " Network Tests:"
kubectl exec -n jira-mcp deployment/jira-mcp-server -- nslookup google.com >/dev/null 2>&1 && echo " DNS resolution working" || echo " DNS resolution failed"
echo ""

# Service endpoints
echo " Service Status:"
kubectl get endpoints -n jira-mcp jira-mcp-server
echo ""

# Configuration
echo "  Configuration:"
kubectl get configmap jira-mcp-config -n jira-mcp -o jsonpath='{.data}' | jq '.' 2>/dev/null || kubectl get configmap jira-mcp-config -n jira-mcp -o yaml
```

### Log Analysis Commands
```bash
# Error frequency analysis
kubectl logs -n jira-mcp deployment/jira-mcp-server --since=1h |
  grep -i error |
  awk '{print $5}' |
  sort | uniq -c | sort -nr

# Performance analysis
kubectl logs -n jira-mcp deployment/jira-mcp-server --since=1h |
  grep -o 'duration=[0-9]*ms' |
  sort -t= -k2 -n | tail -10

# Connection attempts
kubectl logs -n jira-mcp deployment/jira-mcp-server --since=30m |
  grep -E 'connect|timeout|refused'
```

## Application Startup Issues

### Error: `Cannot read properties of undefined (reading 'host')`

**Symptoms:**
```
ERROR [2024-01-15T10:30:00.000Z] Application startup failed
TypeError: Cannot read properties of undefined (reading 'host')
    at JiraClientSecure.constructor
```

**Diagnosis:**
```bash
# Check environment variables
kubectl exec -n jira-mcp deployment/jira-mcp-server -- env | grep JIRA

# Check secret content
kubectl get secret jira-mcp-secrets -n jira-mcp -o jsonpath='{.data}' | base64 -d
```

**Resolution:**
```bash
# Verify required environment variables exist
kubectl patch secret jira-mcp-secrets -n jira-mcp --patch='
{
  "data": {
    "JIRA_HOST": "'$(echo -n "your-domain.atlassian.net" | base64)'",
    "JIRA_EMAIL": "'$(echo -n "user@company.com" | base64)'",
    "JIRA_API_TOKEN": "'$(echo -n "your-token" | base64)'"
  }
}'

# Restart deployment
kubectl rollout restart deployment/jira-mcp-server -n jira-mcp
```

### Error: `MODULE_NOT_FOUND`

**Symptoms:**
```
Error: Cannot find module '@modelcontextprotocol/sdk'
    at Module._resolveFilename
```

**Diagnosis:**
```bash
# Check if build completed successfully
kubectl exec -n jira-mcp deployment/jira-mcp-server -- ls -la /app/node_modules/@modelcontextprotocol/

# Check package.json integrity
kubectl exec -n jira-mcp deployment/jira-mcp-server -- cat /app/package.json | jq '.dependencies'
```

**Resolution:**
```bash
# Rebuild container with proper dependencies
docker build --no-cache -t jira-mcp-server:latest .
kubectl set image deployment/jira-mcp-server -n jira-mcp jira-mcp-server=jira-mcp-server:latest
```

### Error: `EADDRINUSE` (Port already in use)

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::8080
```

**Diagnosis:**
```bash
# Check for multiple instances
kubectl get pods -n jira-mcp -l app.kubernetes.io/name=jira-mcp-server

# Check port conflicts
kubectl exec -n jira-mcp deployment/jira-mcp-server -- netstat -tulpn | grep :8080
```

**Resolution:**
```bash
# Scale down and up to clear port conflicts
kubectl scale deployment jira-mcp-server -n jira-mcp --replicas=0
sleep 10
kubectl scale deployment jira-mcp-server -n jira-mcp --replicas=2
```

## Jira API Connection Problems

### Error: `JIRA_CONNECTION_FAILED`

**Symptoms:**
```
ERROR [correlationId] Jira connection failed
Error: getaddrinfo ENOTFOUND your-domain.atlassian.net
```

**Diagnosis:**
```bash
# Test DNS resolution
kubectl exec -n jira-mcp deployment/jira-mcp-server -- nslookup your-domain.atlassian.net

# Test network connectivity
kubectl exec -n jira-mcp deployment/jira-mcp-server -- nc -zv your-domain.atlassian.net 443

# Check network policies
kubectl describe networkpolicy -n jira-mcp
```

**Resolution:**
```bash
# Verify network policy allows HTTPS egress
kubectl apply -f - << 'EOF'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: jira-mcp-egress
  namespace: jira-mcp
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: jira-mcp-server
  policyTypes:
  - Egress
  egress:
  - ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
EOF
```

### Error: `JIRA_API_TIMEOUT`

**Symptoms:**
```
ERROR [correlationId] Jira API request timeout after 10000ms
Request: GET /rest/api/3/board
```

**Diagnosis:**
```bash
# Test API response time
kubectl exec -n jira-mcp deployment/jira-mcp-server -- \
  curl -w "Total time: %{time_total}s\n" -o /dev/null -s \
  -u "email@company.com:token" \
  "https://your-domain.atlassian.net/rest/api/3/myself"

# Check current timeout settings
kubectl get configmap jira-mcp-config -n jira-mcp -o jsonpath='{.data.REQUEST_TIMEOUT_MS}'
```

**Resolution:**
```bash
# Increase timeout settings
kubectl patch configmap jira-mcp-config -n jira-mcp --patch='
{
  "data": {
    "REQUEST_TIMEOUT_MS": "30000",
    "MAX_EXECUTION_TIME_MS": "45000"
  }
}'

# Restart to apply changes
kubectl rollout restart deployment/jira-mcp-server -n jira-mcp
```

### Error: `JIRA_RATE_LIMIT_EXCEEDED`

**Symptoms:**
```
ERROR [correlationId] Jira API rate limit exceeded
Response: 429 Too Many Requests
Rate limit: 300 requests per minute
```

**Diagnosis:**
```bash
# Check current rate limiting configuration
kubectl get configmap jira-mcp-config -n jira-mcp -o jsonpath='{.data}' | grep RATE_LIMIT

# Monitor request frequency
kubectl logs -n jira-mcp deployment/jira-mcp-server --since=5m |
  grep "Jira API request" | wc -l
```

**Resolution:**
```bash
# Reduce request rate
kubectl patch configmap jira-mcp-config -n jira-mcp --patch='
{
  "data": {
    "RATE_LIMIT_WINDOW_MS": "120000",
    "RATE_LIMIT_MAX_REQUESTS": "20"
  }
}'

# Scale down temporarily to reduce load
kubectl scale deployment jira-mcp-server -n jira-mcp --replicas=1
```

## Authentication & Authorization

### Error: `JIRA_AUTH_FAILED (401)`

**Symptoms:**
```
ERROR [correlationId] Jira authentication failed
Response: 401 Unauthorized
Message: Basic authentication with passwords is deprecated
```

**Diagnosis:**
```bash
# Test API token manually
kubectl exec -n jira-mcp deployment/jira-mcp-server -- \
  curl -u "$(kubectl get secret jira-mcp-secrets -n jira-mcp -o jsonpath='{.data.JIRA_EMAIL}' | base64 -d):$(kubectl get secret jira-mcp-secrets -n jira-mcp -o jsonpath='{.data.JIRA_API_TOKEN}' | base64 -d)" \
  "https://$(kubectl get secret jira-mcp-secrets -n jira-mcp -o jsonpath='{.data.JIRA_HOST}' | base64 -d)/rest/api/3/myself"

# Check token format (should start with ATATT3x)
kubectl get secret jira-mcp-secrets -n jira-mcp -o jsonpath='{.data.JIRA_API_TOKEN}' | base64 -d | head -c 10
```

**Resolution:**
```bash
# Generate new API token at https://id.atlassian.com/manage-profile/security/api-tokens
# Update secret with new token
kubectl patch secret jira-mcp-secrets -n jira-mcp --patch='
{
  "data": {
    "JIRA_API_TOKEN": "'$(echo -n "NEW_TOKEN_HERE" | base64)'"
  }
}'

# Restart application
kubectl rollout restart deployment/jira-mcp-server -n jira-mcp
```

### Error: `JIRA_PERMISSION_DENIED (403)`

**Symptoms:**
```
ERROR [correlationId] Jira permission denied
Response: 403 Forbidden
Resource: /rest/api/3/board/123
```

**Diagnosis:**
```bash
# Check user permissions
kubectl exec -n jira-mcp deployment/jira-mcp-server -- \
  curl -u "email:token" \
  "https://your-domain.atlassian.net/rest/api/3/permissions"

# Test specific board access
kubectl exec -n jira-mcp deployment/jira-mcp-server -- \
  curl -u "email:token" \
  "https://your-domain.atlassian.net/rest/agile/1.0/board/123"
```

**Resolution:**
```bash
# Contact Jira administrator to grant necessary permissions:
# - Browse Projects
# - View Development Tools
# - Administer Projects (for board access)

# Or update project whitelist to only include accessible projects
kubectl patch configmap jira-mcp-config -n jira-mcp --patch='
{
  "data": {
    "JIRA_PROJECT_WHITELIST": "PROJECT1,PROJECT2"
  }
}'
```

## Performance Issues

### Error: `HIGH_RESPONSE_TIME`

**Symptoms:**
```
WARN [correlationId] High response time detected
Duration: 8500ms
Operation: get_closed_items
Board IDs: [123, 456]
```

**Diagnosis:**
```bash
# Check resource usage
kubectl top pods -n jira-mcp

# Check CPU throttling
kubectl describe pods -n jira-mcp -l app.kubernetes.io/name=jira-mcp-server | grep -A 5 -B 5 throttl

# Monitor request patterns
kubectl logs -n jira-mcp deployment/jira-mcp-server --since=10m |
  grep -o 'duration=[0-9]*ms' |
  sort -t= -k2 -n | tail -20
```

**Resolution:**
```bash
# Increase resource limits
kubectl patch deployment jira-mcp-server -n jira-mcp --patch='
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

# Enable request caching
kubectl patch configmap jira-mcp-config -n jira-mcp --patch='
{
  "data": {
    "CACHE_TTL_MINUTES": "30"
  }
}'
```

### Error: `MEMORY_LEAK_DETECTED`

**Symptoms:**
```
WARN [correlationId] High memory usage detected
Memory usage: 450MB / 512MB (87.8%)
```

**Diagnosis:**
```bash
# Monitor memory usage over time
kubectl top pods -n jira-mcp -l app.kubernetes.io/name=jira-mcp-server --containers

# Check for memory leaks in logs
kubectl logs -n jira-mcp deployment/jira-mcp-server | grep -i "memory\|heap\|gc"

# Generate heap dump (if Node.js profiling enabled)
kubectl exec -n jira-mcp deployment/jira-mcp-server -- kill -USR2 1
```

**Resolution:**
```bash
# Restart pods to clear memory
kubectl rollout restart deployment/jira-mcp-server -n jira-mcp

# Increase memory limits
kubectl patch deployment jira-mcp-server -n jira-mcp --patch='
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "jira-mcp-server",
          "resources": {
            "limits": {"memory": "1Gi"}
          }
        }]
      }
    }
  }
}'

# Enable memory monitoring
kubectl patch deployment jira-mcp-server -n jira-mcp --patch='
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "jira-mcp-server",
          "env": [{"name": "NODE_OPTIONS", "value": "--max-old-space-size=512"}]
        }]
      }
    }
  }
}'
```

## Network Connectivity

### Error: `DNS_RESOLUTION_FAILED`

**Symptoms:**
```
ERROR [correlationId] DNS resolution failed for your-domain.atlassian.net
Error: getaddrinfo ENOTFOUND your-domain.atlassian.net
```

**Diagnosis:**
```bash
# Test DNS from pod
kubectl exec -n jira-mcp deployment/jira-mcp-server -- nslookup your-domain.atlassian.net

# Check CoreDNS status
kubectl get pods -n kube-system -l k8s-app=kube-dns

# Check DNS configuration
kubectl exec -n jira-mcp deployment/jira-mcp-server -- cat /etc/resolv.conf
```

**Resolution:**
```bash
# Restart CoreDNS
kubectl delete pods -n kube-system -l k8s-app=kube-dns

# Update DNS configuration if needed
kubectl patch deployment jira-mcp-server -n jira-mcp --patch='
{
  "spec": {
    "template": {
      "spec": {
        "dnsConfig": {
          "nameservers": ["8.8.8.8", "8.8.4.4"]
        }
      }
    }
  }
}'
```

### Error: `TLS_HANDSHAKE_FAILED`

**Symptoms:**
```
ERROR [correlationId] TLS handshake failed
Error: unable to verify the first certificate
Host: your-domain.atlassian.net:443
```

**Diagnosis:**
```bash
# Test TLS connection
kubectl exec -n jira-mcp deployment/jira-mcp-server -- \
  openssl s_client -connect your-domain.atlassian.net:443 -servername your-domain.atlassian.net

# Check certificate chain
kubectl exec -n jira-mcp deployment/jira-mcp-server -- \
  curl -vI https://your-domain.atlassian.net 2>&1 | grep -i certificate
```

**Resolution:**
```bash
# Update CA certificates in container
kubectl patch deployment jira-mcp-server -n jira-mcp --patch='
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "jira-mcp-server",
          "env": [{"name": "NODE_TLS_REJECT_UNAUTHORIZED", "value": "0"}]
        }]
      }
    }
  }
}'

# Note: Only use NODE_TLS_REJECT_UNAUTHORIZED=0 for testing, not production
```

## Container & Kubernetes Issues

### Error: `CrashLoopBackOff`

**Symptoms:**
```bash
kubectl get pods -n jira-mcp
NAME                                READY   STATUS             RESTARTS   AGE
jira-mcp-server-xxx                 0/1     CrashLoopBackOff   5          10m
```

**Diagnosis:**
```bash
# Check crash reason
kubectl describe pod -n jira-mcp jira-mcp-server-xxx

# Check recent logs
kubectl logs -n jira-mcp jira-mcp-server-xxx --previous

# Check events
kubectl get events -n jira-mcp --sort-by='.lastTimestamp'
```

**Resolution Steps:**
1. **Exit Code 0 (Normal termination but restarting)**:
   ```bash
   # Check if process is exiting normally
   kubectl logs -n jira-mcp jira-mcp-server-xxx | tail -20
   ```

2. **Exit Code 1 (General errors)**:
   ```bash
   # Check for startup errors
   kubectl logs -n jira-mcp jira-mcp-server-xxx | grep -i error
   ```

3. **Exit Code 125 (Docker daemon error)**:
   ```bash
   # Check container configuration
   kubectl describe pod -n jira-mcp jira-mcp-server-xxx | grep -A 10 "Container"
   ```

4. **Exit Code 137 (SIGKILL - out of memory)**:
   ```bash
   # Increase memory limits
   kubectl patch deployment jira-mcp-server -n jira-mcp --patch='
   {
     "spec": {
       "template": {
         "spec": {
           "containers": [{
             "name": "jira-mcp-server",
             "resources": {
               "limits": {"memory": "1Gi"},
               "requests": {"memory": "512Mi"}
             }
           }]
         }
       }
     }
   }'
   ```

### Error: `ImagePullBackOff`

**Symptoms:**
```bash
kubectl get pods -n jira-mcp
NAME                                READY   STATUS             RESTARTS   AGE
jira-mcp-server-xxx                 0/1     ImagePullBackOff   0          5m
```

**Diagnosis:**
```bash
# Check image details
kubectl describe pod -n jira-mcp jira-mcp-server-xxx | grep -A 5 "Failed to pull image"

# Check image exists
docker pull jira-mcp-server:latest

# Check registry authentication
kubectl get secrets -n jira-mcp
```

**Resolution:**
```bash
# Update image tag
kubectl patch deployment jira-mcp-server -n jira-mcp --patch='
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "jira-mcp-server",
          "image": "jira-mcp-server:latest",
          "imagePullPolicy": "Always"
        }]
      }
    }
  }
}'

# Add image pull secrets if needed
kubectl patch serviceaccount jira-mcp-service-account -n jira-mcp --patch='
{
  "imagePullSecrets": [{"name": "regcred"}]
}'
```

## Microsoft Copilot Integration Issues

### Error: `BOT_FRAMEWORK_AUTH_FAILED`

**Symptoms:**
```
ERROR [correlationId] Bot Framework authentication failed
Response: 401 Unauthorized from https://login.microsoftonline.com/
```

**Diagnosis:**
```bash
# Check bot credentials
kubectl get secret jira-mcp-secrets -n jira-mcp -o jsonpath='{.data.BOT_APP_ID}' | base64 -d
kubectl get secret jira-mcp-secrets -n jira-mcp -o jsonpath='{.data.BOT_APP_PASSWORD}' | base64 -d | wc -c

# Test authentication manually
curl -X POST "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_APP_ID&client_secret=YOUR_APP_PASSWORD&scope=https://api.botframework.com/.default"
```

**Resolution:**
```bash
# Verify App Registration in Azure Portal
# Generate new client secret if expired
# Update secret
kubectl patch secret jira-mcp-secrets -n jira-mcp --patch='
{
  "data": {
    "BOT_APP_ID": "'$(echo -n "new-app-id" | base64)'",
    "BOT_APP_PASSWORD": "'$(echo -n "new-app-password" | base64)'"
  }
}'
```

### Error: `COPILOT_WEBHOOK_FAILED`

**Symptoms:**
```
ERROR [correlationId] Failed to process Copilot webhook
Error: Request failed with status code 500
Endpoint: /api/messages
```

**Diagnosis:**
```bash
# Check webhook endpoint
kubectl port-forward -n jira-mcp service/jira-mcp-server 8080:80 &
curl -X POST http://localhost:8080/api/messages \
  -H "Content-Type: application/json" \
  -d '{"type":"message","text":"test"}'

# Check Bot Framework configuration
kubectl logs -n jira-mcp deployment/jira-mcp-server | grep -i "bot\|copilot"
```

**Resolution:**
```bash
# Verify messaging endpoint in Azure Bot Service
# Should be: https://your-domain.com/api/messages
# Update if necessary and restart deployment
kubectl rollout restart deployment/jira-mcp-server -n jira-mcp
```

## Monitoring & Logging Issues

### Error: `METRICS_ENDPOINT_UNAVAILABLE`

**Symptoms:**
```bash
curl http://jira-mcp-server:8080/metrics
curl: (7) Failed to connect to jira-mcp-server port 8080: Connection refused
```

**Diagnosis:**
```bash
# Check if metrics port is exposed
kubectl get service jira-mcp-service -n jira-mcp -o yaml | grep -A 5 ports

# Check if metrics endpoint is responding
kubectl exec -n jira-mcp deployment/jira-mcp-server -- curl -s http://localhost:8080/metrics | head -5
```

**Resolution:**
```bash
# Ensure metrics port is exposed in service
kubectl patch service jira-mcp-service -n jira-mcp --patch='
{
  "spec": {
    "ports": [
      {"name": "http", "port": 80, "targetPort": 8080},
      {"name": "metrics", "port": 8080, "targetPort": 8080}
    ]
  }
}'

# Verify metrics are enabled in configuration
kubectl patch configmap jira-mcp-config -n jira-mcp --patch='
{
  "data": {
    "ENABLE_METRICS": "true"
  }
}'
```

### Error: `LOG_SHIPPING_FAILED`

**Symptoms:**
```
WARN [correlationId] Failed to ship logs to external system
Error: EHOSTUNREACH elasticsearch.logging.svc.cluster.local:9200
```

**Diagnosis:**
```bash
# Check log shipping destination
kubectl exec -n jira-mcp deployment/jira-mcp-server -- nc -zv elasticsearch.logging.svc.cluster.local 9200

# Check Fluent Bit/Fluentd status
kubectl get pods -n logging

# Check log volume mounts
kubectl describe pod -n jira-mcp -l app.kubernetes.io/name=jira-mcp-server | grep -A 5 "Volume Mounts"
```

**Resolution:**
```bash
# Fix log shipping configuration
kubectl patch deployment jira-mcp-server -n jira-mcp --patch='
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "jira-mcp-server",
          "env": [{"name": "LOG_OUTPUT", "value": "stdout"}]
        }]
      }
    }
  }
}'

# Restart log shipping service
kubectl rollout restart daemonset/fluent-bit -n logging
```

## Error Code Reference

| Error Code | HTTP Status | Category | Priority | Typical Resolution Time |
|------------|-------------|----------|----------|-------------------------|
| `JIRA_CONNECTION_FAILED` | 500 | Network | P1 | 5-15 minutes |
| `JIRA_AUTH_FAILED` | 401 | Auth | P1 | 5-10 minutes |
| `JIRA_PERMISSION_DENIED` | 403 | Auth | P2 | 30-60 minutes |
| `JIRA_RATE_LIMIT_EXCEEDED` | 429 | Performance | P2 | 10-30 minutes |
| `JIRA_API_TIMEOUT` | 500 | Performance | P2 | 15-30 minutes |
| `BOT_FRAMEWORK_AUTH_FAILED` | 401 | Auth | P1 | 10-20 minutes |
| `COPILOT_WEBHOOK_FAILED` | 500 | Integration | P2 | 20-45 minutes |
| `DNS_RESOLUTION_FAILED` | 500 | Network | P1 | 5-15 minutes |
| `TLS_HANDSHAKE_FAILED` | 500 | Network | P2 | 15-30 minutes |
| `HIGH_RESPONSE_TIME` | N/A | Performance | P3 | 30-60 minutes |
| `MEMORY_LEAK_DETECTED` | N/A | Performance | P2 | 15-45 minutes |

## Escalation Procedures

### When to Escalate

1. **Immediate Escalation (P1)**:
   - Service completely down for > 15 minutes
   - Authentication failures affecting all users
   - Data loss or corruption

2. **Escalate within 1 hour (P2)**:
   - Performance degradation > 50%
   - Partial service outages
   - Security-related issues

3. **Escalate within 4 hours (P3)**:
   - Minor performance issues
   - Non-critical feature failures
   - Documentation discrepancies

### Escalation Contacts

- **Primary On-Call**: Slack #devops-oncall
- **Secondary**: Platform Team Lead
- **Application Owner**: Development Team Lead
- **Security Issues**: Security Team (security@company.com)

## Prevention Strategies

### Proactive Monitoring

```bash
# Set up alerting rules
cat > alerts.yaml << 'EOF'
groups:
- name: jira-mcp-server
  rules:
  - alert: JiraMCPServerDown
    expr: up{job="jira-mcp-server"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Jira MCP Server is down"

  - alert: JiraMCPHighErrorRate
    expr: rate(jira_api_request_errors_total[5m]) > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"

  - alert: JiraMCPHighLatency
    expr: histogram_quantile(0.95, rate(jira_api_request_duration_seconds_bucket[5m])) > 2
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
EOF
```

### Health Check Automation

```bash
# Automated health check script
cat > health-monitor.sh << 'EOF'
#!/bin/bash
set -euo pipefail

ENDPOINT="${1:-http://jira-mcp-server:8080}"
ALERT_WEBHOOK="${2:-}"

check_health() {
  local endpoint="$1"

  # Health check
  if ! curl -f -m 10 "$endpoint/health" >/dev/null 2>&1; then
    return 1
  fi

  # Readiness check
  if ! curl -f -m 10 "$endpoint/ready" >/dev/null 2>&1; then
    return 1
  fi

  return 0
}

if ! check_health "$ENDPOINT"; then
  echo " Health check failed for $ENDPOINT"

  # Send alert if webhook configured
  if [[ -n "$ALERT_WEBHOOK" ]]; then
    curl -X POST "$ALERT_WEBHOOK" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\" Jira MCP Server health check failed\"}"
  fi

  exit 1
fi

echo " Health check passed"
EOF

chmod +x health-monitor.sh

# Run every 5 minutes via cron
echo "*/5 * * * * /path/to/health-monitor.sh" | crontab -
```

---

**Document Version**: 1.0
**Last Updated**: $(date +%Y-%m-%d)
**Maintained By**: DevOps Team
**Review Frequency**: Quarterly