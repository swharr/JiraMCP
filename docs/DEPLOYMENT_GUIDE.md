# Jira MCP Server Deployment Guide

## Overview

This guide covers deployment strategies for the Jira MCP Server in various environments, from local development to enterprise production deployments.

## Table of Contents
- [Local Development](#local-development)
- [Single User Setup](#single-user-setup)
- [Team Deployment](#team-deployment)
- [Enterprise Deployment](#enterprise-deployment)
- [Cloud Platforms](#cloud-platforms)
- [Security Considerations](#security-considerations)
- [Monitoring & Maintenance](#monitoring--maintenance)

## Local Development

### Prerequisites
- Node.js 18+ installed
- Git for version control
- Code editor (VS Code recommended)

### Setup
```bash
# Clone and setup
git clone https://github.com/your-org/jira-mcp-server.git
cd jira-mcp-server
npm install

# Development environment
cp .env.example .env.development
# Edit .env.development with your credentials

# Run in development mode
npm run dev
```

### Development Features
- **Hot reload** with `--watch` flag
- **Debug logging** enabled by default
- **Local file watching** for configuration changes
- **Test data mocking** available

## Single User Setup

### Personal MacBook/PC
Ideal for individual users who want Jira integration in Claude Desktop.

#### Step 1: Installation
```bash
# Create application directory
mkdir -p ~/Applications/jira-mcp-server
cd ~/Applications/jira-mcp-server

# Download latest release
curl -L https://github.com/your-org/jira-mcp-server/releases/latest/download/jira-mcp-server.tgz | tar xz

# Install dependencies
npm install --production
```

#### Step 2: Configuration
```bash
# Create configuration
cat > .env << EOF
JIRA_HOST=yourcompany.atlassian.net
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your-api-token
JIRA_ALLOWED_PROJECTS=PROJ1,PROJ2
EOF

# Test configuration
npm test
```

#### Step 3: Claude Desktop Integration
```json
{
  "mcpServers": {
    "jira-mcp": {
      "command": "node",
      "args": ["~/Applications/jira-mcp-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

#### Step 4: Service Setup (Optional)
Create a launch agent for automatic startup:

```bash
# Create launch agent
cat > ~/Library/LaunchAgents/com.company.jira-mcp.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.company.jira-mcp</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>$(echo ~)/Applications/jira-mcp-server/dist/index.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>$(echo ~)/Applications/jira-mcp-server</string>
</dict>
</plist>
EOF

# Load the service
launchctl load ~/Library/LaunchAgents/com.company.jira-mcp.plist
```

## Team Deployment

### Shared Server Configuration
For small teams (5-20 users) sharing a common Jira instance.

#### Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐
│ Claude Desktop  │────│ Jira MCP Server  │────│ Jira Cloud  │
│ (Team Members)  │    │ (Shared Server)  │    │ (Company)   │
└─────────────────┘    └──────────────────┘    └─────────────┘
```

#### Server Setup
```bash
# On team server (Linux/macOS)
sudo useradd -m -s /bin/bash jira-mcp
sudo su - jira-mcp

# Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Install application
git clone https://github.com/your-org/jira-mcp-server.git
cd jira-mcp-server
npm install --production
npm run build
```

#### Team Configuration
Create environment-specific configs:

```bash
# Production environment
cat > .env.production << EOF
JIRA_HOST=company.atlassian.net
JIRA_EMAIL=serviceaccount@company.com
JIRA_API_TOKEN=prod-api-token
JIRA_ALLOWED_PROJECTS=PROD,STAGE,DEV
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00/B00/xxx
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/xxx
NODE_ENV=production
EOF

# Set secure permissions
chmod 600 .env.production
```

#### Process Management (systemd)
```bash
# Create systemd service
sudo cat > /etc/systemd/system/jira-mcp.service << EOF
[Unit]
Description=Jira MCP Server
After=network.target

[Service]
Type=simple
User=jira-mcp
Group=jira-mcp
WorkingDirectory=/home/jira-mcp/jira-mcp-server
Environment=NODE_ENV=production
EnvironmentFile=/home/jira-mcp/jira-mcp-server/.env.production
ExecStart=/home/jira-mcp/.nvm/versions/node/v20.11.0/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=jira-mcp

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable jira-mcp
sudo systemctl start jira-mcp
sudo systemctl status jira-mcp
```

#### Team Member Configuration
Each team member configures Claude Desktop to use the shared server:

```json
{
  "mcpServers": {
    "jira-mcp": {
      "command": "ssh",
      "args": [
        "team-server.company.com",
        "/home/jira-mcp/jira-mcp-server/dist/index.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Enterprise Deployment

### High Availability Architecture
For large organizations (100+ users) requiring high availability and scalability.

```
┌─────────────────┐    ┌───────────────┐    ┌─────────────────┐
│ Load Balancer   │────│ MCP Instances │────│ Jira Enterprise │
│ (HAProxy/nginx) │    │ (Multi-zone)  │    │ (Data Center)   │
└─────────────────┘    └───────────────┘    └─────────────────┘
         │                       │
         │              ┌─────────────────┐
         └──────────────│ Monitoring      │
                        │ (ELK/Grafana)   │
                        └─────────────────┘
```

#### Infrastructure Requirements
- **Compute:** 2 vCPU, 4GB RAM per instance
- **Network:** 1 Gbps, low latency to Jira
- **Storage:** 20GB SSD for logs and cache
- **Load Balancer:** SSL termination, health checks
- **Monitoring:** Metrics, logs, alerting

#### Kubernetes Deployment

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: jira-mcp
---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: jira-mcp-config
  namespace: jira-mcp
data:
  JIRA_HOST: "company.atlassian.net"
  RATE_LIMIT_MAX_REQUESTS: "200"
  RATE_LIMIT_WINDOW_MS: "60000"
  NODE_ENV: "production"
---
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: jira-mcp-secrets
  namespace: jira-mcp
type: Opaque
data:
  JIRA_EMAIL: <base64-encoded-email>
  JIRA_API_TOKEN: <base64-encoded-token>
  SLACK_WEBHOOK_URL: <base64-encoded-webhook>
---
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jira-mcp-server
  namespace: jira-mcp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: jira-mcp-server
  template:
    metadata:
      labels:
        app: jira-mcp-server
    spec:
      containers:
      - name: jira-mcp-server
        image: your-registry/jira-mcp-server:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: jira-mcp-config
        - secretRef:
            name: jira-mcp-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: jira-mcp-service
  namespace: jira-mcp
spec:
  selector:
    app: jira-mcp-server
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: jira-mcp-ingress
  namespace: jira-mcp
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - jira-mcp.company.com
    secretName: jira-mcp-tls
  rules:
  - host: jira-mcp.company.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: jira-mcp-service
            port:
              number: 80
```

Deploy to Kubernetes:
```bash
kubectl apply -f k8s/
kubectl get pods -n jira-mcp
kubectl logs -f deployment/jira-mcp-server -n jira-mcp
```

#### Docker Compose (Alternative)
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  jira-mcp-server:
    image: your-registry/jira-mcp-server:latest
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - JIRA_HOST=${JIRA_HOST}
      - JIRA_EMAIL=${JIRA_EMAIL}
      - JIRA_API_TOKEN=${JIRA_API_TOKEN}
      - RATE_LIMIT_MAX_REQUESTS=200
    ports:
      - "3000:3000"
    volumes:
      - ./logs:/app/logs
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - jira-mcp-server

volumes:
  logs:
```

## Cloud Platforms

### AWS Deployment

#### ECS with Fargate
```json
{
  "family": "jira-mcp-server",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/jiraMcpTaskRole",
  "containerDefinitions": [
    {
      "name": "jira-mcp-server",
      "image": "your-account.dkr.ecr.region.amazonaws.com/jira-mcp-server:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"}
      ],
      "secrets": [
        {
          "name": "JIRA_API_TOKEN",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:jira-mcp/api-token"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/jira-mcp-server",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### Lambda Deployment (Serverless)
```javascript
// serverless.yml
service: jira-mcp-server

provider:
  name: aws
  runtime: nodejs20.x
  region: us-west-2
  environment:
    NODE_ENV: production
    JIRA_HOST: ${env:JIRA_HOST}
  iamRoleStatements:
    - Effect: Allow
      Action:
        - secretsmanager:GetSecretValue
      Resource: "arn:aws:secretsmanager:*:*:secret:jira-mcp/*"

functions:
  mcpServer:
    handler: dist/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
    environment:
      JIRA_API_TOKEN: ${ssm:/jira-mcp/api-token~true}

plugins:
  - serverless-offline
  - serverless-typescript
```

### Google Cloud Platform

#### Cloud Run Deployment
```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: jira-mcp-server
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "10"
        autoscaling.knative.dev/minScale: "1"
    spec:
      containerConcurrency: 1000
      containers:
      - image: gcr.io/your-project/jira-mcp-server:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: JIRA_API_TOKEN
          valueFrom:
            secretKeyRef:
              name: jira-mcp-secrets
              key: api-token
        resources:
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

Deploy with gcloud:
```bash
gcloud run deploy jira-mcp-server \
  --image gcr.io/your-project/jira-mcp-server:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production
```

### Azure Container Instances

```yaml
apiVersion: 2021-03-01
location: eastus
name: jira-mcp-server
properties:
  containers:
  - name: jira-mcp-server
    properties:
      image: your-registry.azurecr.io/jira-mcp-server:latest
      resources:
        requests:
          cpu: 1
          memoryInGb: 2
      ports:
      - port: 3000
      environmentVariables:
      - name: NODE_ENV
        value: production
      - name: JIRA_API_TOKEN
        secureValue: your-secure-token
  osType: Linux
  restartPolicy: Always
  ipAddress:
    type: Public
    ports:
    - protocol: tcp
      port: 3000
```

## Security Considerations

### Network Security
- **TLS/SSL:** Always use HTTPS in production
- **Firewall:** Restrict access to necessary ports
- **VPN:** Consider VPN access for enterprise deployments
- **IP Whitelisting:** Limit access to known IP ranges

### Secrets Management
- **Never commit secrets** to version control
- **Use secrets managers** (AWS Secrets Manager, Azure Key Vault, etc.)
- **Rotate credentials** regularly
- **Audit access** to sensitive configurations

### Production Hardening
```bash
# Create dedicated user
sudo useradd -r -s /bin/false jira-mcp

# Set file permissions
sudo chown -R jira-mcp:jira-mcp /opt/jira-mcp-server
sudo chmod 600 /opt/jira-mcp-server/.env
sudo chmod 755 /opt/jira-mcp-server/dist

# Configure log rotation
sudo cat > /etc/logrotate.d/jira-mcp << EOF
/var/log/jira-mcp/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 jira-mcp jira-mcp
    postrotate
        systemctl reload jira-mcp
    endscript
}
EOF
```

### Monitoring Security
```yaml
# Example Prometheus alerts
groups:
- name: jira-mcp-security
  rules:
  - alert: HighErrorRate
    expr: rate(jira_mcp_errors_total[5m]) > 0.1
    for: 2m
    annotations:
      summary: High error rate detected

  - alert: UnauthorizedAccess
    expr: increase(jira_mcp_auth_failures_total[1h]) > 10
    for: 0m
    annotations:
      summary: Multiple authentication failures

  - alert: RateLimitExceeded
    expr: increase(jira_mcp_rate_limit_exceeded_total[5m]) > 50
    for: 1m
    annotations:
      summary: Rate limit frequently exceeded
```

## Monitoring & Maintenance

### Health Checks
```typescript
// Add to your server (optional)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  });
});

app.get('/ready', async (req, res) => {
  try {
    // Test Jira connectivity
    await jiraClient.getBoards();
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});
```

### Logging Configuration
```bash
# Production logging
export DEBUG=""  # Disable debug logs
export LOG_LEVEL="warn"
export LOG_FORMAT="json"
```

### Backup Strategy
```bash
#!/bin/bash
# backup-config.sh

BACKUP_DIR="/var/backups/jira-mcp"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup configuration
tar czf "$BACKUP_DIR/config_$DATE.tar.gz" \
  /opt/jira-mcp-server/.env.production \
  /etc/systemd/system/jira-mcp.service

# Backup logs (last 7 days)
find /var/log/jira-mcp -name "*.log" -mtime -7 \
  -exec tar czf "$BACKUP_DIR/logs_$DATE.tar.gz" {} +

# Clean old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
```

### Update Procedure
```bash
#!/bin/bash
# update-server.sh

set -e

echo "Starting update procedure..."

# Backup current version
sudo systemctl stop jira-mcp
cp -r /opt/jira-mcp-server /opt/jira-mcp-server.backup

# Download and install new version
cd /opt/jira-mcp-server
sudo -u jira-mcp git pull origin main
sudo -u jira-mcp npm install --production
sudo -u jira-mcp npm run build

# Run tests
sudo -u jira-mcp npm test

# Restart service
sudo systemctl start jira-mcp
sudo systemctl status jira-mcp

echo "Update completed successfully!"
```

### Performance Tuning

#### Node.js Optimization
```bash
# Environment variables for production
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=1024"
export UV_THREADPOOL_SIZE=4
```

#### Rate Limiting Tuning
```env
# High-traffic environments
RATE_LIMIT_MAX_REQUESTS=500
RATE_LIMIT_WINDOW_MS=60000

# Conservative environments
RATE_LIMIT_MAX_REQUESTS=30
RATE_LIMIT_WINDOW_MS=60000
```

This comprehensive deployment guide covers all major deployment scenarios from local development to enterprise production environments. Choose the approach that best fits your organization's infrastructure and security requirements.