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
import { HealthService } from './health-service.js';
import { logger } from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

class JiraMCPServer {
  private server: Server;
  private jiraClient: SecureJiraClient;
  private blogScaffolder: BlogScaffolder;
  private healthService: HealthService;

  constructor() {
    logger.info('Initializing Jira MCP Server', {
      operation: 'server_init',
      version: '0.1.0'
    });

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

    logger.info('Configuring Jira client', {
      operation: 'jira_client_init',
      host: process.env.JIRA_HOST,
      allowedProjects: allowedProjects?.length || 0
    });

    this.jiraClient = new SecureJiraClient(
      process.env.JIRA_HOST || '',
      process.env.JIRA_EMAIL || '',
      process.env.JIRA_API_TOKEN || '',
      allowedProjects
    );

    this.blogScaffolder = new BlogScaffolder();

    // Initialize health service
    const healthPort = parseInt(process.env.HEALTH_PORT || '3000', 10);
    this.healthService = new HealthService(healthPort);
    this.healthService.setJiraClient(this.jiraClient);

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
    const startTime = Date.now();
    const requestLogger = logger.child({ operation: 'get_boards' });

    try {
      requestLogger.info('Fetching Jira boards');

      const boards = await this.jiraClient.getBoards();

      const duration = Date.now() - startTime;
      requestLogger.performance('get_boards', duration, {
        boardsCount: boards.length
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(boards, null, 2),
          },
        ],
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      requestLogger.error('Failed to fetch boards', error instanceof Error ? error : new Error(message), {
        duration
      });

      return {
        content: [
          {
            type: 'text',
            text: `Error fetching boards: ${InputValidator.sanitizeErrorMessage(message)}`,
          },
        ],
      };
    }
  }

  private async getClosedItems(args: any) {
    const startTime = Date.now();
    const requestLogger = logger.child({ operation: 'get_closed_items' });

    try {
      const { boardIds, days = 7 } = args;

      requestLogger.info('Validating input parameters', {
        boardIds: Array.isArray(boardIds) ? boardIds.length : 'invalid',
        days
      });

      const validBoardIds = InputValidator.validateBoardIds(boardIds);
      const validDays = InputValidator.validateDays(days);

      requestLogger.info('Fetching closed items from Jira', {
        boardIds: validBoardIds,
        days: validDays
      });

      const closedItems = await this.jiraClient.getClosedItems(validBoardIds, validDays);

      const duration = Date.now() - startTime;
      requestLogger.performance('get_closed_items', duration, {
        boardIds: validBoardIds,
        days: validDays,
        itemsCount: closedItems.length
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(closedItems, null, 2),
          },
        ],
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (error instanceof Error && error.message.includes('Invalid')) {
        requestLogger.validationError('input_parameters', args, message);
      } else {
        requestLogger.error('Failed to fetch closed items', error instanceof Error ? error : new Error(message), {
          duration,
          args
        });
      }

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
    try {
      logger.info('Starting Jira MCP Server', {
        operation: 'server_start',
        transport: 'stdio'
      });

      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      logger.info('Jira MCP Server started successfully', {
        operation: 'server_started',
        pid: process.pid
      });

      // Setup graceful shutdown
      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));
    } catch (error) {
      logger.error('Failed to start Jira MCP Server', error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'server_start_failed'
      });
      throw error;
    }
  }

  private async shutdown() {
    logger.info('Jira MCP Server shutting down', {
      operation: 'server_shutdown',
      pid: process.pid
    });

    try {
      await this.healthService.shutdown();
      logger.info('Health service stopped successfully', {
        operation: 'health_service_shutdown'
      });
    } catch (error) {
      logger.error('Error during health service shutdown', error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'health_service_shutdown_failed'
      });
    }

    logger.info('Jira MCP Server shutdown complete', {
      operation: 'server_shutdown_complete'
    });

    process.exit(0);
  }
}

const server = new JiraMCPServer();
server.start().catch(console.error);