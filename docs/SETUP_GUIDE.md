# Jira MCP Server Setup Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Configuration](#configuration)
- [Testing Your Setup](#testing-your-setup)
- [Integrating with Claude Desktop](#integrating-with-claude-desktop)
- [Notification Setup](#notification-setup)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **Jira Cloud account** with admin access
- **Jira API Token** ([Create one here](https://id.atlassian.com/manage-profile/security/api-tokens))
- **Claude Desktop** installed (for MCP integration)
- (Optional) Slack/Teams webhooks for notifications

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/jira-mcp-server.git
cd jira-mcp-server

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# 4. Build the project
npm run build

# 5. Test your connection
node test-connection.js

# 6. Start the server
npm start
```

## Detailed Setup

### Step 1: Obtain Jira Credentials

1. **Get your Jira domain:**
   - Navigate to your Jira instance
   - Copy the URL (e.g., `yourcompany.atlassian.net`)
   - Remove `https://` prefix

2. **Create an API Token:**
   - Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
   - Click "Create API token"
   - Give it a descriptive name (e.g., "MCP Server Token")
   - Copy the token immediately (you won't see it again)

3. **Identify allowed projects (optional):**
   - List project keys you want to access (e.g., "PROJ", "TEAM")
   - This adds an extra security layer

### Step 2: Configure Environment Variables

Create a `.env` file in the project root:

```env
# Required Configuration
JIRA_HOST=yourcompany.atlassian.net
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your-api-token-here

# Optional Security
JIRA_ALLOWED_PROJECTS=PROJ1,PROJ2,PROJ3

# Optional Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00/B00/XXX
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/XXX
```

### Step 3: Build and Test

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Verify Jira connection
node test-connection.js
```

Expected output:
```
Testing connection to yourcompany.atlassian.net...
Connection successful!
Connected as: John Doe (john.doe@company.com)
```

### Step 4: Configure Claude Desktop

1. **Locate Claude Desktop config:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. **Add the MCP server configuration:**

```json
{
  "mcpServers": {
    "jira-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/jira-mcp-server/dist/index.js"],
      "env": {
        "JIRA_HOST": "yourcompany.atlassian.net",
        "JIRA_EMAIL": "your.email@company.com",
        "JIRA_API_TOKEN": "your-api-token-here",
        "JIRA_ALLOWED_PROJECTS": "PROJ1,PROJ2"
      }
    }
  }
}
```

3. **Restart Claude Desktop** for changes to take effect

## Configuration

### Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `JIRA_HOST` | Yes | Your Atlassian domain | `company.atlassian.net` |
| `JIRA_EMAIL` | Yes | Email for authentication | `user@company.com` |
| `JIRA_API_TOKEN` | Yes | API token from Atlassian | `ATATT3xFfGF0...` |
| `JIRA_ALLOWED_PROJECTS` | No | Comma-separated project keys | `PROJ,TEAM,DEV` |
| `SLACK_WEBHOOK_URL` | No | Slack incoming webhook | `https://hooks.slack.com/...` |
| `SLACK_CHANNEL` | No | Override webhook channel | `#product-updates` |
| `TEAMS_WEBHOOK_URL` | No | Teams incoming webhook | `https://outlook.office.com/...` |
| `RATE_LIMIT_MAX_REQUESTS` | No | Max requests per window | `30` |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit window (ms) | `60000` |

### Security Configuration

#### Project Whitelisting
Limit access to specific Jira projects:

```env
JIRA_ALLOWED_PROJECTS=PROJ1,PROJ2,PROJ3
```

#### Rate Limiting
Customize rate limits to prevent abuse:

```env
RATE_LIMIT_MAX_REQUESTS=50  # Allow 50 requests
RATE_LIMIT_WINDOW_MS=60000  # Per minute
```

## Testing Your Setup

### 1. Connection Test
```bash
node test-connection.js
```

### 2. Unit Tests
```bash
npm test
```

### 3. Test with Claude Desktop

In Claude, try these commands:

```
Use the jira-mcp tool to list all boards
```

```
Use the jira-mcp tool to get closed items from board ID 1 in the last 7 days
```

```
Use the jira-mcp tool to scaffold an announcement for board ID 1
```

## Notification Setup

### Slack Integration

1. **Create Incoming Webhook:**
   - Go to [Slack Apps](https://api.slack.com/apps)
   - Create new app → From scratch
   - Add "Incoming Webhooks" feature
   - Activate and add to workspace
   - Copy webhook URL

2. **Configure in .env:**
```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00/B00/XXX
SLACK_CHANNEL=#product-updates  # Optional
```

3. **Test Slack notification:**
```javascript
// Add to test-notifications.js
import { SlackNotifier } from './dist/notifiers/slack-notifier.js';

const slack = new SlackNotifier(process.env.SLACK_WEBHOOK_URL);
await slack.sendBlogNotification("Test blog content", 5);
```

### Microsoft Teams Integration

1. **Create Incoming Webhook:**
   - In Teams, go to your channel
   - Click menu → Connectors
   - Search for "Incoming Webhook"
   - Configure and copy URL

2. **Configure in .env:**
```env
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/XXX
```

3. **Test Teams notification:**
```javascript
// Add to test-notifications.js
import { TeamsNotifier } from './dist/notifiers/teams-notifier.js';

const teams = new TeamsNotifier(process.env.TEAMS_WEBHOOK_URL);
await teams.sendSecurityAlert("Test Alert", "This is a test", "low");
```

## Using the MCP Tools

Once configured, you can use these tools in Claude:

### 1. List Available Boards
```
Use the jira-mcp get_boards tool
```

### 2. Get Closed Items
```
Use the jira-mcp get_closed_items tool with:
- boardIds: ["1", "2"]
- days: 14
```

### 3. Generate Content
```
Use the jira-mcp scaffold_announcement tool with:
- boardIds: ["1"]
- days: 7
- format: "both"
```

## Troubleshooting

### Common Issues

#### 1. Authentication Failed
**Error:** `Authentication failed. Please check your credentials.`

**Solution:**
- Verify API token is correct and not expired
- Check email matches Jira account
- Ensure token has necessary permissions

#### 2. No Boards Found
**Error:** `No boards returned from Jira`

**Solution:**
- Verify you have access to at least one board
- Check JIRA_ALLOWED_PROJECTS if configured
- Ensure your account has proper permissions

#### 3. Rate Limit Exceeded
**Error:** `Rate limit exceeded. Please try again later.`

**Solution:**
- Wait 60 seconds before retrying
- Increase rate limits in configuration
- Check for infinite loops in automation

#### 4. MCP Server Not Found in Claude
**Error:** Claude doesn't recognize the MCP server

**Solution:**
1. Verify config file location is correct
2. Check JSON syntax is valid
3. Ensure absolute paths are used
4. Restart Claude Desktop completely

#### 5. Network/Firewall Issues
**Error:** `ECONNREFUSED` or timeout errors

**Solution:**
- Check firewall allows HTTPS to `*.atlassian.net`
- Verify proxy settings if behind corporate network
- Test with `curl https://your-domain.atlassian.net`

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
# Set debug environment variable
DEBUG=* npm start

# Or in your .env file
DEBUG=jira-mcp:*
```

### Verify Installation

Run this checklist:

```bash
# 1. Check Node version
node --version  # Should be 18+

# 2. Verify dependencies installed
npm list

# 3. Check build succeeded
ls dist/  # Should contain .js files

# 4. Test Jira connection
node test-connection.js

# 5. Run tests
npm test

# 6. Check Claude config
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

## Advanced Configuration

### Running as a Service

#### macOS (launchd)
Create `~/Library/LaunchAgents/com.company.jira-mcp.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.company.jira-mcp</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/jira-mcp-server/dist/index.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

Load the service:
```bash
launchctl load ~/Library/LaunchAgents/com.company.jira-mcp.plist
```

#### Linux (systemd)
Create `/etc/systemd/system/jira-mcp.service`:

```ini
[Unit]
Description=Jira MCP Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/jira-mcp-server
ExecStart=/usr/bin/node dist/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable jira-mcp
sudo systemctl start jira-mcp
```

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY .env.example ./
USER node
CMD ["node", "dist/index.js"]
```

Build and run:
```bash
docker build -t jira-mcp-server .
docker run --env-file .env jira-mcp-server
```

## Getting Help

- **GitHub Issues:** [Report bugs or request features](https://github.com/your-org/jira-mcp-server/issues)
- **Documentation:** Check the [README](../README.md) and this guide
- **Logs:** Enable debug mode for detailed logging
- **Community:** Join our Slack channel #jira-mcp-support

## Next Steps

1. Complete basic setup
2. Configure your first board monitoring
3. Set up notifications
4. Create your first automated blog post
5. Monitor usage and adjust rate limits
6. Review security settings

Your Jira MCP Server is now ready to use.