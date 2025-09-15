import express, { Request, Response } from 'express';
import { SecureJiraClient } from './jira-client-secure.js';
import { logger } from './logger.js';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      time?: string;
    };
  };
}

export interface ReadinessStatus {
  status: 'ready' | 'not_ready';
  timestamp: string;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail';
      message?: string;
    };
  };
}

export interface MetricsData {
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  requests: {
    total: number;
    errors: number;
    rate: number;
  };
}

interface HealthOptions {
  devMode?: boolean;
  requireToken?: boolean;
  token?: string;
}

export class HealthService {
  private app: express.Application;
  private jiraClient?: SecureJiraClient;
  private startTime: number;
  private requestCount: number = 0;
  private errorCount: number = 0;
  private options: Required<Pick<HealthOptions, 'devMode' | 'requireToken'>> & { token?: string };

  constructor(port: number = 3000, host: string = '127.0.0.1', options: HealthOptions = {}) {
    this.app = express();
    this.startTime = Date.now();
    this.options = {
      devMode: options.devMode ?? false,
      requireToken: options.requireToken ?? false,
      token: options.token,
    };
    this.setupMiddleware();
    this.setupRoutes();
    this.start(port, host);
  }

  setJiraClient(client: SecureJiraClient): void {
    this.jiraClient = client;
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    // Request counting middleware
    this.app.use((req, res, next) => {
      this.requestCount++;

      const originalSend = res.send;
      const self = this;
      res.send = function(data: any) {
        if (res.statusCode >= 400) {
          self.errorCount++;
        }
        return originalSend.call(this, data);
      };

      next();
    });

    // Basic security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint (liveness probe)
    this.app.get('/health', this.getHealth.bind(this));

    // Readiness check endpoint (readiness probe)
    this.app.get('/ready', this.getReadiness.bind(this));

    // Metrics endpoint (protected in non-dev)
    this.app.get('/metrics', this.authIfRequired.bind(this), this.getMetrics.bind(this));

    // Info endpoint (protected in non-dev)
    this.app.get('/info', this.authIfRequired.bind(this), this.getInfo.bind(this));
  }

  private authIfRequired(req: Request, res: Response, next: () => void): void {
    if (!this.options.requireToken) {
      return next();
    }
    const token = (req.headers['x-health-token'] as string | undefined) || undefined;
    if (!token || !this.options.token || token !== this.options.token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  }

  private async getHealth(req: Request, res: Response): Promise<void> {
    const checks: HealthStatus['checks'] = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    // Memory check
    const memoryUsage = process.memoryUsage();
    const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    if (memoryPercentage > 90) {
      checks.memory = { status: 'fail', message: `Memory usage critical: ${memoryPercentage.toFixed(1)}%` };
      overallStatus = 'unhealthy';
    } else if (memoryPercentage > 75) {
      checks.memory = { status: 'warn', message: `Memory usage high: ${memoryPercentage.toFixed(1)}%` };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    } else {
      checks.memory = { status: 'pass', message: `Memory usage normal: ${memoryPercentage.toFixed(1)}%` };
    }

    // Uptime check
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    checks.uptime = {
      status: 'pass',
      message: `Service running for ${uptimeSeconds} seconds`
    };

    // Error rate check
    const errorRate = this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
    if (errorRate > 50) {
      checks.error_rate = { status: 'fail', message: `Error rate critical: ${errorRate.toFixed(1)}%` };
      overallStatus = 'unhealthy';
    } else if (errorRate > 20) {
      checks.error_rate = { status: 'warn', message: `Error rate elevated: ${errorRate.toFixed(1)}%` };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    } else {
      checks.error_rate = { status: 'pass', message: `Error rate normal: ${errorRate.toFixed(1)}%` };
    }

    const health: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: uptimeSeconds,
      checks
    };

    const statusCode = overallStatus === 'healthy' ? 200 :
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(health);
  }

  private async getReadiness(req: Request, res: Response): Promise<void> {
    const checks: ReadinessStatus['checks'] = {};
    let isReady = true;

    // Check if Jira client is configured
    if (!this.jiraClient) {
      checks.jira_client = {
        status: 'fail',
        message: 'Jira client not configured'
      };
      isReady = false;
    } else {
      // Test Jira connectivity
      try {
        await this.jiraClient.getBoards();
        checks.jira_connectivity = {
          status: 'pass',
          message: 'Jira API accessible'
        };
      } catch (error) {
        checks.jira_connectivity = {
          status: 'fail',
          message: 'Cannot connect to Jira API'
        };
        isReady = false;
      }
    }

    // Check environment variables
    const requiredEnvVars = ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      checks.environment = {
        status: 'fail',
        message: `Missing required environment variables: ${missingVars.join(', ')}`
      };
      isReady = false;
    } else {
      checks.environment = {
        status: 'pass',
        message: 'All required environment variables present'
      };
    }

    const readiness: ReadinessStatus = {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks
    };

    res.status(isReady ? 200 : 503).json(readiness);
  }

  private async getMetrics(req: Request, res: Response): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    const metrics: MetricsData = {
      timestamp: new Date().toISOString(),
      uptime,
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        rate: uptime > 0 ? this.requestCount / uptime : 0
      }
    };

    res.json(metrics);
  }

  private async getInfo(req: Request, res: Response): Promise<void> {
    const info = {
      name: 'jira-mcp-server',
      version: process.env.npm_package_version || '0.1.0',
      description: 'Enterprise-grade MCP server for Jira integration',
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      started: new Date(this.startTime).toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };

    res.json(info);
  }

  private start(port: number, host: string): void {
    this.app.listen(port, host, () => {
      logger.info('Health service started', {
        operation: 'health_service_start',
        port,
        host,
        devMode: this.options.devMode,
        protected: this.options.requireToken
      });
    });
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    logger.info('Health service shutting down', {
      operation: 'health_service_shutdown'
    });
    // Add any cleanup logic here
  }
}
