# Jira MCP Server API Reference

## Overview

This document provides detailed technical information about the Jira MCP Server's API endpoints, data structures, and integration patterns.

## MCP Tools Reference

### get_boards

Lists all available Jira boards accessible to the configured account.

**Schema:**
```json
{
  "name": "get_boards",
  "description": "List all available Jira boards",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "[{\"id\": 1, \"name\": \"Board Name\", \"type\": \"scrum\"}]"
    }
  ]
}
```

**Example:**
```javascript
// Tool call
{
  "name": "get_boards",
  "arguments": {}
}

// Response
{
  "content": [
    {
      "type": "text",
      "text": "[\n  {\n    \"id\": 1,\n    \"name\": \"Product Development\",\n    \"type\": \"scrum\"\n  },\n  {\n    \"id\": 2,\n    \"name\": \"Marketing Team\",\n    \"type\": \"kanban\"\n  }\n]"
    }
  ]
}
```

---

### get_closed_items

Retrieves recently closed items from specified Jira boards.

**Schema:**
```json
{
  "name": "get_closed_items",
  "description": "Get closed items from specific Jira boards",
  "inputSchema": {
    "type": "object",
    "properties": {
      "boardIds": {
        "type": "array",
        "items": { "type": "string" },
        "description": "List of board IDs to check"
      },
      "days": {
        "type": "number",
        "description": "Number of days to look back for closed items",
        "default": 7,
        "minimum": 1,
        "maximum": 90
      }
    },
    "required": ["boardIds"]
  }
}
```

**Parameters:**
- `boardIds` (string[]): Array of board IDs (1-10 boards max)
- `days` (number, optional): Lookback period in days (1-90, default: 7)

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "[{\"id\": \"10001\", \"key\": \"PROJ-123\", \"fields\": {...}}]"
    }
  ]
}
```

**Example:**
```javascript
// Tool call
{
  "name": "get_closed_items",
  "arguments": {
    "boardIds": ["1", "2"],
    "days": 14
  }
}

// Response includes full Jira issue objects
```

---

### scaffold_announcement

Generates formatted blog posts and announcements from closed Jira items.

**Schema:**
```json
{
  "name": "scaffold_announcement",
  "description": "Generate blog and announcement content for closed Jira items",
  "inputSchema": {
    "type": "object",
    "properties": {
      "boardIds": {
        "type": "array",
        "items": { "type": "string" },
        "description": "List of board IDs to check"
      },
      "days": {
        "type": "number",
        "description": "Number of days to look back for closed items",
        "default": 7,
        "minimum": 1,
        "maximum": 90
      },
      "format": {
        "type": "string",
        "enum": ["blog", "announcement", "both"],
        "description": "Output format for the content",
        "default": "both"
      }
    },
    "required": ["boardIds"]
  }
}
```

**Parameters:**
- `boardIds` (string[]): Array of board IDs
- `days` (number, optional): Lookback period (default: 7)
- `format` (string, optional): Output format - "blog", "announcement", or "both" (default: "both")

**Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "# Product Updates - January 15, 2024\n\nWe're excited to share..."
    }
  ]
}
```

## Data Structures

### JiraBoard

```typescript
interface JiraBoard {
  id: number;          // Unique board identifier
  name: string;        // Human-readable board name
  type: string;        // Board type: "scrum", "kanban", etc.
}
```

### JiraIssue

```typescript
interface JiraIssue {
  id: string;          // Unique issue identifier
  key: string;         // Human-readable issue key (e.g., "PROJ-123")
  fields: {
    summary: string;                    // Issue title
    description?: string;               // Issue description (optional)
    status: {
      name: string;                     // Current status
    };
    issuetype: {
      name: string;                     // Issue type (Story, Bug, Task, etc.)
    };
    assignee?: {
      displayName: string;              // Assignee name (optional)
    };
    resolution?: {
      name: string;                     // Resolution type (optional)
    };
    resolutiondate?: string;            // ISO date string (optional)
    created: string;                    // ISO date string
    updated: string;                    // ISO date string
    priority?: {
      name: string;                     // Priority level (optional)
    };
    labels?: string[];                  // Array of labels (optional)
    components?: Array<{               // Project components (optional)
      name: string;
    }>;
  };
}
```

### MCP Response Format

All tools return responses in the MCP standard format:

```typescript
interface MCPResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
}
```

## Input Validation

### Board ID Validation
- **Format:** Alphanumeric characters, hyphens, and underscores only
- **Pattern:** `/^[a-zA-Z0-9_-]+$/`
- **Limits:** 1-10 board IDs per request
- **Examples:**
  - Valid: "123", "board-456", "BOARD_789"
  - Invalid: "board@123", "board with spaces"

### Days Validation
- **Range:** 1-90 days
- **Type:** Integer
- **Default:** 7
- **Examples:**
  - Valid: 1, 7, 30, 90
  - Invalid: 0, -5, 91, "abc"

### Format Validation
- **Options:** "blog", "announcement", "both"
- **Default:** "both"
- **Case-sensitive:** Must match exactly

## Error Handling

### Error Response Format
```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: [sanitized error message]"
    }
  ]
}
```

### Common Error Types

#### Authentication Errors
```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: Authentication failed. Please check your credentials."
    }
  ]
}
```

#### Validation Errors
```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: boardIds must be an array"
    }
  ]
}
```

#### Rate Limit Errors
```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: Rate limit exceeded. Please try again later."
    }
  ]
}
```

#### Network Errors
```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: Failed to fetch boards: [URL_REDACTED]"
    }
  ]
}
```

## Security Features

### Input Sanitization
All inputs undergo strict validation:
- Board IDs: Regex pattern matching
- Numeric values: Range checking
- String values: Enum validation

### Output Sanitization
All responses are sanitized:
- HTML/Script tag removal
- URL redaction in errors
- Email address redaction
- Token/credential redaction

### Rate Limiting
- **Default:** 30 requests per 60 seconds
- **Scope:** Global across all tools
- **Configurable:** Via environment variables

### Project Access Control
- **Optional:** `JIRA_ALLOWED_PROJECTS` environment variable
- **Format:** Comma-separated project keys
- **Effect:** Restricts board access to specified projects

## Configuration Reference

### Environment Variables

```typescript
interface EnvironmentConfig {
  // Required
  JIRA_HOST: string;                    // Atlassian domain
  JIRA_EMAIL: string;                   // Authentication email
  JIRA_API_TOKEN: string;               // API token

  // Optional Security
  JIRA_ALLOWED_PROJECTS?: string;       // Comma-separated project keys
  RATE_LIMIT_MAX_REQUESTS?: string;     // Max requests per window
  RATE_LIMIT_WINDOW_MS?: string;        // Rate limit window in milliseconds

  // Optional Notifications
  SLACK_WEBHOOK_URL?: string;           // Slack webhook URL
  SLACK_CHANNEL?: string;               // Override default channel
  TEAMS_WEBHOOK_URL?: string;           // Teams webhook URL
}
```

### Default Values
```typescript
const defaults = {
  RATE_LIMIT_MAX_REQUESTS: 30,
  RATE_LIMIT_WINDOW_MS: 60000,
  REQUEST_TIMEOUT: 10000,
  MAX_RESULTS_PER_BOARD: 50,
  MAX_BOARDS_PER_REQUEST: 10
};
```

## Internal API Endpoints

### Jira REST API Usage

The server interacts with these Jira endpoints:

#### Get Boards
```
GET /rest/agile/1.0/board
Parameters:
  - maxResults: 50
```

#### Get Board Configuration
```
GET /rest/agile/1.0/board/{boardId}/configuration
```

#### Search Issues
```
GET /rest/api/2/search
Parameters:
  - jql: string (parameterized)
  - maxResults: 50
  - fields: string (comma-separated)
```

#### Get Project
```
GET /rest/api/2/project/{projectId}
```

### Authentication
- **Method:** Basic Authentication
- **Username:** Email address
- **Password:** API token
- **Headers:** `Accept: application/json`

## Performance Characteristics

### Response Times (typical)
- `get_boards`: 500-1000ms
- `get_closed_items`: 1-3 seconds per board
- `scaffold_announcement`: 2-5 seconds

### Caching
- **Duration:** 15 minutes for repeated requests
- **Scope:** Per unique parameter combination
- **Implementation:** In-memory LRU cache

### Timeouts
- **API Requests:** 10 seconds
- **Total Tool Execution:** 30 seconds

## Integration Patterns

### Claude Desktop Integration

```json
{
  "mcpServers": {
    "jira-mcp": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "JIRA_HOST": "company.atlassian.net",
        "JIRA_EMAIL": "user@company.com",
        "JIRA_API_TOKEN": "token"
      }
    }
  }
}
```

### Programmatic Usage (Node.js)

```typescript
import { JiraMCPServer } from './jira-mcp-server';

const server = new JiraMCPServer();
await server.start();

// The server runs as an MCP server via stdio
```

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Monitoring and Observability

### Logging
- **Level:** Error, Warn, Info (configurable)
- **Format:** Structured JSON
- **Sensitive Data:** Automatically redacted

### Metrics (Available via logs)
- Request count by tool
- Response times
- Error rates
- Rate limit hits

### Health Checks
```typescript
// Connection test utility
node test-connection.js
```

## Version Compatibility

### Node.js Support
- **Minimum:** Node.js 18.x
- **Recommended:** Node.js 20.x
- **Tested:** 18.x, 20.x, 22.x

### Jira API Compatibility
- **Jira Cloud:** Full support
- **Jira Server:** Not supported
- **API Versions:** REST API v2 and Agile v1.0

### MCP Protocol
- **Version:** 1.0.4
- **Transport:** stdio
- **Features:** Tools only (no resources/prompts)

## Development Reference

### Building from Source
```bash
npm install
npm run build
npm test
```

### Running Tests
```bash
npm test                    # Unit tests
npm run test:coverage      # With coverage
npm run test:integration   # Integration tests
```

### Linting and Formatting
```bash
npm run lint               # ESLint
npm run typecheck         # TypeScript
```

This completes the API reference documentation. The server provides a secure, well-validated interface for Jira integration with comprehensive error handling and performance optimization.