# Jira MCP Server

A secure, enterprise-ready MCP (Model Context Protocol) server that connects to Jira instances, monitors specific boards for closed items, and automatically generates blog posts and announcements for PMM organizations.

## Features

- **Jira Integration**: Connect to Jira Cloud instances with secure API authentication
- **Board Monitoring**: Track multiple boards for recently completed work
- **Content Generation**: Automatically scaffold blog posts and announcements
- **Team Recognition**: Extract and credit contributors automatically
- **Smart Notifications**: Send updates via Slack and Microsoft Teams
- **Enterprise Security**: Input validation, rate limiting, and audit trails
- **High Performance**: Caching, timeouts, and optimized API usage
- **Well Tested**: 80%+ code coverage with comprehensive test suite

## Documentation

| Document | Description |
|----------|-------------|
| [Setup Guide](docs/SETUP_GUIDE.md) | Complete installation and configuration instructions |
| [User Manual](docs/USER_MANUAL.md) | Daily usage, workflows, and best practices |
| [API Reference](docs/API_REFERENCE.md) | Technical API documentation and data structures |
| [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) | Production deployment strategies and scaling |
| [Security Report](SECURITY_REPORT.md) | Security audit findings and implemented protections |

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/your-org/jira-mcp-server.git
cd jira-mcp-server
npm install

# 2. Configure credentials
cp .env.example .env
# Edit .env with your Jira credentials

# 3. Build and test
npm run build
npm test
node test-connection.js

# 4. Start using with Claude Desktop
```

See the [Setup Guide](docs/SETUP_GUIDE.md) for detailed instructions.

## MCP Tools

| Tool | Purpose | Parameters |
|------|---------|------------|
| `get_boards` | List available Jira boards | None |
| `get_closed_items` | Fetch recently closed items | `boardIds[]`, `days?` |
| `scaffold_announcement` | Generate content | `boardIds[]`, `days?`, `format?` |

## Example Usage in Claude

```bash
# Discover boards
"Use jira-mcp to list all available boards"

# Get recent completions
"Show me items closed in boards 1 and 2 in the last 14 days"

# Generate update content
"Create a PMM announcement for board 1 covering the last week"
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐
│ Claude Desktop  │────│ Jira MCP Server  │────│ Jira Cloud  │
│                 │    │                  │    │             │
│ • Tools API     │    │ • Input Validation│    │ • Issues    │
│ • User Prompts  │    │ • Rate Limiting   │    │ • Boards    │
│ • Content Gen   │    │ • Security Layer  │    │ • Projects  │
└─────────────────┘    └──────────────────┘    └─────────────┘
         │                       │
         │              ┌─────────────────┐
         └──────────────│ Notifications   │
                        │ • Slack         │
                        │ • MS Teams      │
                        └─────────────────┘
```

## Security Features

- **Input Validation**: Prevents injection attacks with strict parameter validation
- **Rate Limiting**: Configurable request throttling (30 req/min default)
- **Authentication**: Secure API token-based authentication
- **Project Whitelisting**: Optional access control by Jira project
- **Error Sanitization**: Sensitive data redaction in error messages
- **XSS Protection**: HTML/script tag sanitization
- **Audit Logging**: Comprehensive security event logging

## Testing & Quality

- **Unit Tests**: 100% validator and core logic coverage
- **Integration Tests**: End-to-end workflow validation
- **Security Tests**: Injection prevention and access control
- **CI/CD Pipeline**: Automated testing, security scanning, and deployment
- **Code Quality**: ESLint, TypeScript strict mode, SonarCloud analysis

## Deployment Options

| Environment | Best For | Guide |
|-------------|----------|-------|
| **Local Development** | Individual developers | [Setup Guide](docs/SETUP_GUIDE.md#local-development) |
| **Single User** | Personal Claude Desktop usage | [Setup Guide](docs/SETUP_GUIDE.md#single-user-setup) |
| **Team Server** | Small teams (5-20 users) | [Deployment Guide](docs/DEPLOYMENT_GUIDE.md#team-deployment) |
| **Enterprise** | Large organizations (100+ users) | [Deployment Guide](docs/DEPLOYMENT_GUIDE.md#enterprise-deployment) |
| **Cloud Platforms** | AWS, GCP, Azure deployments | [Deployment Guide](docs/DEPLOYMENT_GUIDE.md#cloud-platforms) |

## Content Formats

### Blog Posts
```markdown
# Product Updates - January 15, 2024

## New Features & Enhancements
### Major Initiatives Completed
### Feature Updates

## Bug Fixes
## Technical Improvements
## What's Next?
```

### Announcements
```markdown
# PMM Release Announcement - Jan 15, 2024

## Key Highlights
## Summary Statistics
## Team Recognition
## More Information
```

## Notification Integrations

### Slack
- Rich message formatting with blocks
- Issue type categorization with visual indicators
- Clickable Jira links
- Team contributor mentions

### Microsoft Teams
- Adaptive card format
- Action buttons for quick access
- Visual indicators and statistics
- Corporate-friendly formatting

## Development

```bash
# Development setup
npm run dev          # Start with hot reload
npm test             # Run test suite
npm run test:watch   # Watch mode testing
npm run typecheck    # TypeScript validation
npm run lint         # Code linting

# Security & Quality
npm audit           # Dependency vulnerabilities
npm run test:coverage # Coverage report
```

## Performance

- **Response Times**: 500ms-3s depending on request complexity
- **Rate Limiting**: Configurable (default: 30 req/min)
- **Caching**: 15-minute cache for repeated requests
- **Timeouts**: 10s API timeouts, 30s total execution
- **Scalability**: Supports horizontal scaling in container environments

## Support

- **Documentation**: Comprehensive guides in `/docs`
- **Issues**: [GitHub Issues](https://github.com/your-org/jira-mcp-server/issues)
- **Community**: Slack #jira-mcp-support
- **Debug**: Enable debug logging with `DEBUG=jira-mcp:*`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass and coverage remains high
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Anthropic** for the MCP protocol and Claude integration
- **Atlassian** for the comprehensive Jira API
- **Open Source Community** for the excellent tooling and libraries

Start with the [Setup Guide](docs/SETUP_GUIDE.md) to get your first automated blog post generated in under 10 minutes.