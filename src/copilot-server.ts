/**
 * Microsoft Copilot Server Implementation
 *
 * This module sets up a Bot Framework server to handle Microsoft Copilot interactions
 * alongside the existing MCP server functionality.
 */

import express from 'express';
import { BotFrameworkAdapter, ConversationState, MemoryStorage, UserState } from 'botbuilder';
import { CopilotAdapter, createCopilotAdapter } from './copilot-adapter.js';
import { JiraClientSecure } from './jira-client-secure.js';
import { logger } from './logger.js';
import { rateLimiter } from './rate-limiter.js';

interface CopilotServerConfig {
  port: number;
  appId: string;
  appPassword: string;
  tenantId?: string;
  enabledCommands: string[];
}

export class CopilotServer {
  private app: express.Application;
  private adapter: BotFrameworkAdapter;
  private bot: CopilotAdapter;
  private config: CopilotServerConfig;
  private jiraClient: JiraClientSecure;

  constructor(jiraClient: JiraClientSecure, config: CopilotServerConfig) {
    this.jiraClient = jiraClient;
    this.config = config;
    this.app = express();
    this.setupExpress();
    this.setupBotAdapter();
    this.setupBot();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupExpress(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Apply rate limiting
    this.app.use('/api/messages', rateLimiter);

    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      const correlationId = `copilot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      req.correlationId = correlationId;

      logger.info('Copilot request received', {
        correlationId,
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type')
      });

      next();
    });
  }

  /**
   * Setup Bot Framework adapter
   */
  private setupBotAdapter(): void {
    this.adapter = new BotFrameworkAdapter({
      appId: this.config.appId,
      appPassword: this.config.appPassword
    });

    // Configure error handling
    this.adapter.onTurnError = async (context, error) => {
      const correlationId = context.turnState.get('correlationId') || 'unknown';

      logger.error('Bot Framework turn error', {
        correlationId,
        error: error.message,
        stack: error.stack,
        activity: context.activity
      });

      // Send error message to user
      await context.sendActivity('Sorry, an error occurred while processing your message.');

      // Clear conversation state if error is persistent
      if (error.message.includes('ConversationReference')) {
        const conversationState = new ConversationState(new MemoryStorage());
        const userState = new UserState(new MemoryStorage());
        await conversationState.clear(context);
        await userState.clear(context);
      }
    };
  }

  /**
   * Setup the bot with conversation state
   */
  private setupBot(): void {
    // Create storage and state
    const memoryStorage = new MemoryStorage();
    const conversationState = new ConversationState(memoryStorage);
    const userState = new UserState(memoryStorage);

    // Create bot instance
    this.bot = createCopilotAdapter(this.jiraClient, {
      appId: this.config.appId,
      appPassword: this.config.appPassword,
      tenantId: this.config.tenantId,
      enabledCommands: this.config.enabledCommands
    });

    // Add state management middleware
    this.adapter.use(conversationState);
    this.adapter.use(userState);
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Bot Framework messages endpoint
    this.app.post('/api/messages', async (req, res) => {
      const correlationId = req.correlationId;

      try {
        // Store correlation ID in turn state for logging
        await this.adapter.processActivity(req, res, async (context) => {
          context.turnState.set('correlationId', correlationId);
          await this.bot.run(context);
        });
      } catch (error) {
        logger.error('Error processing Copilot message', {
          correlationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        res.status(500).json({
          error: 'Internal server error',
          correlationId
        });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'jira-mcp-copilot-server',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.0'
      });
    });

    // Readiness check
    this.app.get('/ready', async (req, res) => {
      try {
        // Test Jira connection
        await this.jiraClient.getBoards();
        res.json({
          status: 'ready',
          services: {
            jira: 'connected',
            bot: 'initialized'
          }
        });
      } catch (error) {
        res.status(503).json({
          status: 'not ready',
          error: 'Jira connection failed'
        });
      }
    });

    // Bot information endpoint
    this.app.get('/bot/info', (req, res) => {
      res.json({
        appId: this.config.appId,
        enabledCommands: this.config.enabledCommands,
        supportedFormats: ['blog', 'announcement', 'slack', 'teams'],
        capabilities: [
          'list_boards',
          'get_closed_items',
          'scaffold_announcement',
          'natural_language_processing'
        ]
      });
    });

    // Configuration endpoint (sensitive data removed)
    this.app.get('/config', (req, res) => {
      res.json({
        port: this.config.port,
        enabledCommands: this.config.enabledCommands,
        rateLimiting: {
          windowMs: process.env.RATE_LIMIT_WINDOW_MS || 60000,
          maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || 30
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });

    // Global error handler
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const correlationId = req.correlationId || 'unknown';

      logger.error('Express error handler', {
        correlationId,
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method
      });

      res.status(500).json({
        error: 'Internal server error',
        correlationId
      });
    });
  }

  /**
   * Start the Copilot server
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const server = this.app.listen(this.config.port, () => {
          logger.info('Copilot server started', {
            port: this.config.port,
            appId: this.config.appId,
            enabledCommands: this.config.enabledCommands
          });
          resolve();
        });

        // Handle server errors
        server.on('error', (error) => {
          logger.error('Copilot server error', { error: error.message });
          reject(error);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
          logger.info('Received SIGTERM, shutting down Copilot server gracefully');
          server.close(() => {
            logger.info('Copilot server closed');
            process.exit(0);
          });
        });

        process.on('SIGINT', () => {
          logger.info('Received SIGINT, shutting down Copilot server gracefully');
          server.close(() => {
            logger.info('Copilot server closed');
            process.exit(0);
          });
        });

      } catch (error) {
        reject(error);
      }
    });
  }
}

/**
 * Factory function to create and configure Copilot server
 */
export function createCopilotServer(jiraClient: JiraClientSecure, config: CopilotServerConfig): CopilotServer {
  return new CopilotServer(jiraClient, config);
}

// Extend Express Request interface for correlation ID
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}