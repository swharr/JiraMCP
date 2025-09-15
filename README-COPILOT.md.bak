# Microsoft Copilot Integration

This branch provides integration between the Jira MCP Server and Microsoft Copilot, enabling natural language interactions with Jira through Microsoft Teams and other Copilot-enabled applications.

## Features

- **Natural Language Processing**: Interact with Jira using conversational commands
- **Microsoft Bot Framework**: Full integration with Microsoft's bot ecosystem
- **Multi-Modal Support**: Works in Microsoft Teams, Outlook, and other Copilot environments
- **Enterprise Security**: Azure AD integration and secure credential management
- **Comprehensive Monitoring**: Built-in health checks and logging for enterprise deployments

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐
│ Microsoft       │    │ Jira MCP Server  │    │ Jira Cloud  │
│ Copilot/Teams   │────│ (Copilot Mode)   │────│             │
│                 │    │                  │    │ • Issues    │
│ • Chat Interface│    │ • Bot Framework  │    │ • Boards    │
│ • Natural Lang  │    │ • NLP Processing │    │ • Projects  │
│ • Commands      │    │ • Security Layer │    │             │
└─────────────────┘    └──────────────────┘    └─────────────┘
         │                       │
         │              ┌─────────────────┐
         └──────────────│ Notifications   │
                        │ • Slack         │
                        │ • MS Teams      │
                        └─────────────────┘
```

## Quick Start

### 1. Prerequisites

- Node.js 20+
- Azure Bot Service registration
- Jira Cloud instance with API access
- Microsoft Teams or Copilot access

### 2. Azure Bot Setup

1. **Create Azure Bot Resource**:
   ```bash
   az bot create \
     --resource-group myResourceGroup \
     --name jira-mcp-bot \
     --kind webapp \
     --sku S1 \
     --location "East US"
   ```

2. **Get Bot Credentials**:
   - App ID: From Azure Portal > Bot Service > Configuration
   - App Password: Generate new secret in Azure Portal > App Registrations

3. **Configure Messaging Endpoint**:
   - Set to: `https://your-domain.com/api/messages`
   - Enable Microsoft Teams channel

### 3. Installation

```bash
# Clone the repository and switch to copilot branch
git clone https://github.com/your-org/jira-mcp-server.git
cd jira-mcp-server
git checkout feature/microsoft-copilot-integration

# Install dependencies (includes Bot Framework)
npm install

# Copy and configure environment
cp .env.copilot.example .env.copilot
# Edit .env.copilot with your credentials

# Build the application
npm run build

# Start in Copilot mode
npm run start:copilot
```

### 4. Configuration

Update `.env.copilot` with your credentials:

```bash
# Jira Configuration
JIRA_HOST=your-domain.atlassian.net
JIRA_EMAIL=user@company.com
JIRA_API_TOKEN=your-jira-api-token

# Bot Framework Configuration
BOT_APP_ID=your-azure-bot-app-id
BOT_APP_PASSWORD=your-azure-bot-password
BOT_PORT=3979

# Optional: Azure AD Tenant
BOT_TENANT_ID=your-tenant-id
```

## Usage Examples

### In Microsoft Teams

1. **Add the bot to Teams**:
   - Go to Apps > Custom Apps > Upload
   - Or install from Teams App Store (if published)

2. **Start a conversation**:
   ```
   @JiraMCP list boards

   @JiraMCP show closed items for board 123 in the last 2 weeks

   @JiraMCP create announcement for boards 123, 456 last month

   @JiraMCP help
   ```

### Natural Language Examples

The bot understands various phrasings:

```
"What boards do we have?"
"Show me completed tasks from last week"
"Generate a PMM update for project Alpha"
"What was finished in board 123 recently?"
"Create a blog post about our recent releases"
```

## Supported Commands

| Command Pattern | Description | Example |
|----------------|-------------|---------|
| **Board Management** |
| `list boards`, `show boards` | Display available Jira boards | `list all available boards` |
| **Closed Items** |
| `closed items for board X` | Get recent completions | `show closed items for board 123 last 14 days` |
| `completed tasks in [timeframe]` | Recent completions | `completed tasks this month` |
| **Announcements** |
| `create announcement for board X` | Generate content | `create PMM announcement for board 123` |
| `generate [format] for boards X,Y` | Multi-board content | `generate blog post for boards 123, 456` |
| **Help** |
| `help`, `commands`, `what can you do` | Show available commands | `help me get started` |

## Supported Output Formats

- **Blog Post**: Structured markdown for external publishing
- **PMM Announcement**: Executive summary format
- **Slack**: Rich formatting optimized for Slack
- **Teams**: Adaptive cards for Microsoft Teams
- **Plain Text**: Simple text output

## Deployment

### Azure App Service

```bash
# Create App Service
az webapp create \
  --resource-group myResourceGroup \
  --plan myAppServicePlan \
  --name jira-mcp-copilot \
  --runtime "NODE|20-lts"

# Configure app settings
az webapp config appsettings set \
  --resource-group myResourceGroup \
  --name jira-mcp-copilot \
  --settings \
    JIRA_HOST="your-domain.atlassian.net" \
    BOT_APP_ID="your-app-id" \
    BOT_APP_PASSWORD="your-app-password"

# Deploy code
az webapp deployment source config-zip \
  --resource-group myResourceGroup \
  --name jira-mcp-copilot \
  --src deployment.zip
```

### Container Deployment

```bash
# Build container
docker build -f Dockerfile.copilot -t jira-mcp-copilot .

# Run container
docker run -d \
  --name jira-mcp-copilot \
  --env-file .env.copilot \
  -p 3979:3979 \
  jira-mcp-copilot
```

### Kubernetes Deployment

```bash
# Use the provided Helm chart with Copilot values
helm install jira-mcp-copilot ./helm/jira-mcp-server \
  -f values-copilot.yaml \
  --set copilot.enabled=true \
  --set copilot.botAppId="your-app-id" \
  --set copilot.botAppPassword="your-app-password"
```

## Security Considerations

### Authentication & Authorization

- **Azure AD Integration**: Bot authenticates through Azure Bot Framework
- **API Token Security**: Jira API tokens stored securely in Azure Key Vault
- **Rate Limiting**: Configurable request throttling per user/conversation
- **Input Validation**: All user inputs sanitized and validated

### Network Security

- **HTTPS Only**: All communications encrypted in transit
- **Webhook Security**: Bot Framework handles webhook validation
- **IP Whitelisting**: Optional restriction to corporate networks
- **Audit Logging**: Comprehensive logging of all interactions

### Data Privacy

- **No Data Storage**: Conversations not persisted beyond session
- **PII Filtering**: Sensitive information automatically redacted
- **Jira Permissions**: Users can only access boards they have permission for
- **Corporate Compliance**: Configurable data retention policies

## Monitoring & Observability

### Health Checks

```bash
# Application health
curl https://your-bot-url/health

# Bot readiness
curl https://your-bot-url/ready

# Bot configuration
curl https://your-bot-url/bot/info
```

### Logging

The bot provides structured logging with correlation IDs:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "Copilot command processed",
  "correlationId": "copilot-123456789",
  "userId": "user@company.com",
  "command": "list_boards",
  "responseTime": 245,
  "boardCount": 12
}
```

### Metrics

Available metrics for monitoring:

- Request count and latency
- Command usage statistics
- Error rates and types
- Jira API performance
- User engagement metrics

## Troubleshooting

### Common Issues

1. **Bot not responding**:
   ```bash
   # Check health endpoint
   curl https://your-bot-url/health

   # Check logs
   kubectl logs deployment/jira-mcp-copilot
   ```

2. **Authentication errors**:
   - Verify Bot App ID and Password in Azure Portal
   - Check Azure Bot Service messaging endpoint
   - Ensure bot is added to Teams

3. **Jira connection issues**:
   - Test API token with curl
   - Check network connectivity
   - Verify Jira permissions

4. **Commands not working**:
   - Check enabled commands configuration
   - Review natural language processing logs
   - Verify board IDs exist and are accessible

### Debug Mode

Enable detailed logging:

```bash
LOG_LEVEL=debug npm run start:copilot
```

### Support Channels

- **GitHub Issues**: Technical problems and feature requests
- **Teams Channel**: `#jira-mcp-support` for user questions
- **Documentation**: Comprehensive guides in `/docs/copilot/`

## Differences from MCP Mode

| Feature | MCP Mode | Copilot Mode |
|---------|----------|--------------|
| **Interface** | Claude Desktop stdio | Microsoft Teams/Copilot |
| **Transport** | JSON-RPC over stdio | HTTP REST + Bot Framework |
| **Authentication** | Local config file | Azure AD + Bot Framework |
| **Natural Language** | Claude's processing | Custom NLP implementation |
| **Deployment** | Local/single user | Enterprise/multi-user |
| **Security** | File-based secrets | Azure Key Vault integration |

## Development

### Local Development

```bash
# Start with hot reload
npm run dev:copilot

# Test with Bot Framework Emulator
# Download from: https://github.com/Microsoft/BotFramework-Emulator
```

### Testing

```bash
# Unit tests
npm test

# Integration tests with mock Teams
npm run test:copilot

# Security tests
npm run test:security
```

### Contributing

1. All Copilot features should be in the `feature/microsoft-copilot-integration` branch
2. Maintain backward compatibility with MCP mode
3. Add comprehensive tests for natural language processing
4. Update documentation for new commands

## Roadmap

- [ ] **Voice Commands**: Integration with Cortana and voice assistants
- [ ] **Adaptive Cards**: Rich interactive cards in Teams
- [ ] **Proactive Messaging**: Automated notifications for Jira updates
- [ ] **Multi-language Support**: International language processing
- [ ] **Advanced Analytics**: Usage analytics and insights dashboard
- [ ] **Custom Actions**: User-defined workflows and automations

## License

Same MIT license as the main project. See [LICENSE](../LICENSE) file for details.