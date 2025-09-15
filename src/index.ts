#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SecureJiraClient } from './jira-client-secure.js';
import { BlogScaffolder } from './blog-scaffolder.js';
import { InputValidator } from './validators.js';
import dotenv from 'dotenv';

dotenv.config();

class JiraMCPServer {
  private server: Server;
  private jiraClient: SecureJiraClient;
  private blogScaffolder: BlogScaffolder;

  constructor() {
    this.server = new Server(
      {
        name: 'jira-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Parse allowed projects from environment
    const allowedProjects = process.env.JIRA_ALLOWED_PROJECTS
      ? process.env.JIRA_ALLOWED_PROJECTS.split(',').map(p => p.trim())
      : undefined;

    this.jiraClient = new SecureJiraClient(
      process.env.JIRA_HOST || '',
      process.env.JIRA_EMAIL || '',
      process.env.JIRA_API_TOKEN || '',
      allowedProjects
    );

    this.blogScaffolder = new BlogScaffolder();

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'get_closed_items':
          return await this.getClosedItems(args);
        case 'scaffold_announcement':
          return await this.scaffoldAnnouncement(args);
        case 'get_boards':
          return await this.getBoards();
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'get_boards',
        description: 'List all available Jira boards',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_closed_items',
        description: 'Get closed items from specific Jira boards',
        inputSchema: {
          type: 'object',
          properties: {
            boardIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of board IDs to check',
            },
            days: {
              type: 'number',
              description: 'Number of days to look back for closed items',
              default: 7,
            },
          },
          required: ['boardIds'],
        },
      },
      {
        name: 'scaffold_announcement',
        description: 'Generate blog and announcement content for closed Jira items',
        inputSchema: {
          type: 'object',
          properties: {
            boardIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of board IDs to check',
            },
            days: {
              type: 'number',
              description: 'Number of days to look back for closed items',
              default: 7,
            },
            format: {
              type: 'string',
              enum: ['blog', 'announcement', 'both'],
              description: 'Output format for the content',
              default: 'both',
            },
          },
          required: ['boardIds'],
        },
      },
    ];
  }

  private async getBoards() {
    try {
      const boards = await this.jiraClient.getBoards();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(boards, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching boards: ${error}`,
          },
        ],
      };
    }
  }

  private async getClosedItems(args: any) {
    try {
      const { boardIds, days = 7 } = args;
      const validBoardIds = InputValidator.validateBoardIds(boardIds);
      const validDays = InputValidator.validateDays(days);

      const closedItems = await this.jiraClient.getClosedItems(validBoardIds, validDays);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(closedItems, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${InputValidator.sanitizeErrorMessage(message)}`,
          },
        ],
      };
    }
  }

  private async scaffoldAnnouncement(args: any) {
    try {
      const { boardIds, days = 7, format = 'both' } = args;
      const validBoardIds = InputValidator.validateBoardIds(boardIds);
      const validDays = InputValidator.validateDays(days);
      const validFormat = InputValidator.validateFormat(format);

      const closedItems = await this.jiraClient.getClosedItems(validBoardIds, validDays);

      const content = this.blogScaffolder.generateContent(closedItems, validFormat);

      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${InputValidator.sanitizeErrorMessage(message)}`,
          },
        ],
      };
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Jira MCP Server started');
  }
}

const server = new JiraMCPServer();
server.start().catch(console.error);