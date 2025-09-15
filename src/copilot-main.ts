/**
 * Microsoft Copilot Integration Entry Point
 *
 * This is an alternative entry point that runs the server in Copilot mode
 * instead of MCP mode. It can be used to deploy the service specifically
 * for Microsoft Copilot integration.
 */

import dotenv from 'dotenv';
import { JiraClientSecure } from './jira-client-secure.js';
import { createCopilotServer } from './copilot-server.js';
import { logger } from './logger.js';

// Load environment variables
dotenv.config();

/**
 * Environment variable validation and configuration
 */
function getConfiguration() {
  const requiredEnvVars = [
    'JIRA_HOST',
    'JIRA_EMAIL',
    'JIRA_API_TOKEN',
    'BOT_APP_ID',
    'BOT_APP_PASSWORD'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  return {
    // Jira configuration
    jira: {
      host: process.env.JIRA_HOST!,
      email: process.env.JIRA_EMAIL!,
      apiToken: process.env.JIRA_API_TOKEN!,
      projectWhitelist: process.env.JIRA_PROJECT_WHITELIST?.split(',') || [],
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
      rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30', 10),
      requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '10000', 10),
      maxExecutionTimeMs: parseInt(process.env.MAX_EXECUTION_TIME_MS || '30000', 10),
      cacheTtlMinutes: parseInt(process.env.CACHE_TTL_MINUTES || '15', 10)
    },

    // Bot configuration
    bot: {
      port: parseInt(process.env.BOT_PORT || '3979', 10),
      appId: process.env.BOT_APP_ID!,
      appPassword: process.env.BOT_APP_PASSWORD!,
      tenantId: process.env.BOT_TENANT_ID,
      enabledCommands: process.env.BOT_ENABLED_COMMANDS?.split(',') || [
        'list_boards',
        'get_closed_items',
        'scaffold_announcement',
        'help'
      ]
    },

    // Notification configuration (optional for Copilot mode)
    notifications: {
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
      teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL
    },

    // Environment settings
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info'
    }
  };
}

/**
 * Initialize and start the Copilot server
 */
async function startCopilotServer() {
  try {
    const config = getConfiguration();

    logger.info('Starting Jira MCP Copilot Server', {
      nodeEnv: config.environment.nodeEnv,
      port: config.bot.port,
      appId: config.bot.appId,
      jiraHost: config.jira.host,
      enabledCommands: config.bot.enabledCommands
    });

    // Initialize secure Jira client
    const jiraClient = new JiraClientSecure({
      host: config.jira.host,
      email: config.jira.email,
      apiToken: config.jira.apiToken,
      projectWhitelist: config.jira.projectWhitelist,
      rateLimitWindowMs: config.jira.rateLimitWindowMs,
      rateLimitMaxRequests: config.jira.rateLimitMaxRequests,
      requestTimeoutMs: config.jira.requestTimeoutMs,
      maxExecutionTimeMs: config.jira.maxExecutionTimeMs,
      cacheTtlMinutes: config.jira.cacheTtlMinutes,
      slackWebhookUrl: config.notifications.slackWebhookUrl,
      teamsWebhookUrl: config.notifications.teamsWebhookUrl
    });

    // Test Jira connection
    logger.info('Testing Jira connection...');
    const boards = await jiraClient.getBoards();
    logger.info('Jira connection successful', { boardCount: boards.length });

    // Create and start Copilot server
    const copilotServer = createCopilotServer(jiraClient, {
      port: config.bot.port,
      appId: config.bot.appId,
      appPassword: config.bot.appPassword,
      tenantId: config.bot.tenantId,
      enabledCommands: config.bot.enabledCommands
    });

    await copilotServer.start();

    logger.info('Jira MCP Copilot Server is running', {
      port: config.bot.port,
      healthCheck: `http://localhost:${config.bot.port}/health`,
      webhookEndpoint: `http://localhost:${config.bot.port}/api/messages`
    });

  } catch (error) {
    logger.error('Failed to start Copilot server', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    process.exit(1);
  }
}

/**
 * Handle uncaught exceptions and unhandled rejections
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in Copilot server', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in Copilot server', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString()
  });
  process.exit(1);
});

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  startCopilotServer();
}