import axios, { AxiosInstance, AxiosError } from 'axios';
import { InputValidator } from './validators.js';
import { RateLimiter } from './rate-limiter.js';

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      name: string;
    };
    issuetype: {
      name: string;
    };
    assignee?: {
      displayName: string;
    };
    resolution?: {
      name: string;
    };
    resolutiondate?: string;
    created: string;
    updated: string;
    priority?: {
      name: string;
    };
    labels?: string[];
    components?: Array<{ name: string }>;
  };
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
}

export class SecureJiraClient {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;
  private allowedProjects: Set<string> = new Set();

  constructor(
    private host: string,
    private email: string,
    private apiToken: string,
    allowedProjects?: string[]
  ) {
    // Validate inputs
    if (!host || !email || !apiToken) {
      throw new Error('Jira credentials not configured');
    }

    // Validate host format
    if (!/^[a-zA-Z0-9.-]+\.atlassian\.net$/.test(host)) {
      throw new Error('Invalid Jira host format');
    }

    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(30, 60000); // 30 requests per minute

    // Set allowed projects if specified
    if (allowedProjects) {
      this.allowedProjects = new Set(allowedProjects);
    }

    this.client = axios.create({
      baseURL: `https://${host}/rest`,
      auth: {
        username: email,
        password: apiToken,
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });

    // Add request interceptor for rate limiting
    this.client.interceptors.request.use(
      (config) => {
        if (!this.rateLimiter.isAllowed('global')) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for sanitization
    this.client.interceptors.response.use(
      (response) => {
        response.data = InputValidator.sanitizeJiraResponse(response.data);
        return response;
      },
      (error) => {
        if (error.response) {
          error.message = InputValidator.sanitizeErrorMessage(error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  async getBoards(): Promise<JiraBoard[]> {
    try {
      const response = await this.client.get('/agile/1.0/board', {
        params: {
          maxResults: 50, // Limit results
        },
      });

      if (response.status !== 200) {
        throw new Error('Failed to fetch boards');
      }

      const boards = response.data.values || [];

      // Filter boards by allowed projects if configured
      if (this.allowedProjects.size > 0) {
        const filteredBoards = [];
        for (const board of boards) {
          const projectKey = await this.getBoardProject(String(board.id));
          if (projectKey && this.allowedProjects.has(projectKey)) {
            filteredBoards.push(board);
          }
        }
        return filteredBoards;
      }

      return boards;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch boards: ${InputValidator.sanitizeErrorMessage(message)}`);
    }
  }

  async getClosedItems(boardIds: string[], daysBack: number = 7): Promise<JiraIssue[]> {
    // Validate inputs
    const validBoardIds = InputValidator.validateBoardIds(boardIds);
    const validDays = InputValidator.validateDays(daysBack);

    const closedItems: JiraIssue[] = [];
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - validDays);
    const formattedDate = dateFrom.toISOString().split('T')[0];

    for (const boardId of validBoardIds) {
      try {
        const projectKey = await this.getBoardProject(boardId);

        if (!projectKey) {
          console.warn(`No project found for board ${boardId}`);
          continue;
        }

        // Check if project is allowed
        if (this.allowedProjects.size > 0 && !this.allowedProjects.has(projectKey)) {
          console.warn(`Project ${projectKey} is not in allowed list`);
          continue;
        }

        // Build JQL with proper escaping
        const jql = this.buildSecureJQL(projectKey, formattedDate);

        const response = await this.client.get('/api/2/search', {
          params: {
            jql,
            maxResults: 50, // Limit results per board
            fields: 'summary,description,status,issuetype,assignee,resolution,resolutiondate,created,updated,priority,labels,components',
          },
        });

        if (response.status === 200 && response.data.issues) {
          closedItems.push(...response.data.issues);
        }
      } catch (error) {
        console.error(`Error fetching issues for board ${boardId}:`, InputValidator.sanitizeErrorMessage(error));
      }
    }

    return closedItems;
  }

  private buildSecureJQL(projectKey: string, fromDate: string): string {
    // Escape special characters in project key
    const escapedProject = projectKey.replace(/['"\\]/g, '\\$&');

    // Build JQL with parameterized values
    return [
      `project = "${escapedProject}"`,
      'AND status in (Done, Closed, Resolved)',
      `AND resolutiondate >= "${fromDate}"`,
      'ORDER BY resolutiondate DESC'
    ].join(' ');
  }

  private async getBoardProject(boardId: string): Promise<string> {
    try {
      // Validate board ID format
      if (!/^[0-9]+$/.test(boardId)) {
        throw new Error('Invalid board ID format');
      }

      const response = await this.client.get(`/agile/1.0/board/${boardId}/configuration`);

      if (response.status !== 200) {
        return '';
      }

      const projectId = response.data.filter?.projectId;

      if (projectId) {
        const projectResponse = await this.client.get(`/api/2/project/${projectId}`);
        if (projectResponse.status === 200) {
          return projectResponse.data.key;
        }
      }

      return '';
    } catch (error) {
      console.error(`Error fetching board configuration:`, InputValidator.sanitizeErrorMessage(error));
      return '';
    }
  }

  async getIssueDetails(issueKey: string): Promise<JiraIssue | null> {
    // Validate issue key format
    if (!/^[A-Z]+-[0-9]+$/.test(issueKey)) {
      throw new Error('Invalid issue key format');
    }

    try {
      const response = await this.client.get(`/api/2/issue/${issueKey}`);

      if (response.status !== 200) {
        return null;
      }

      return response.data;
    } catch (error) {
      console.error(`Error fetching issue:`, InputValidator.sanitizeErrorMessage(error));
      return null;
    }
  }
}