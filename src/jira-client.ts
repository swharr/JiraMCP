import axios, { AxiosInstance } from 'axios';

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

export class JiraClient {
  private client: AxiosInstance;

  constructor(
    private host: string,
    private email: string,
    private apiToken: string
  ) {
    if (!host || !email || !apiToken) {
      throw new Error('Jira credentials not configured. Please set JIRA_HOST, JIRA_EMAIL, and JIRA_API_TOKEN environment variables.');
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
    });
  }

  async getBoards(): Promise<JiraBoard[]> {
    try {
      const response = await this.client.get('/agile/1.0/board');
      return response.data.values || [];
    } catch (error) {
      console.error('Error fetching boards:', error);
      throw error;
    }
  }

  async getClosedItems(boardIds: string[], daysBack: number = 7): Promise<JiraIssue[]> {
    const closedItems: JiraIssue[] = [];
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - daysBack);
    const formattedDate = dateFrom.toISOString().split('T')[0];

    for (const boardId of boardIds) {
      try {
        const jql = `project IN (${await this.getBoardProject(boardId)}) AND status in (Done, Closed, Resolved) AND resolutiondate >= '${formattedDate}' ORDER BY resolutiondate DESC`;

        const response = await this.client.get('/api/2/search', {
          params: {
            jql,
            maxResults: 100,
            fields: 'summary,description,status,issuetype,assignee,resolution,resolutiondate,created,updated,priority,labels,components',
          },
        });

        if (response.data.issues) {
          closedItems.push(...response.data.issues);
        }
      } catch (error) {
        console.error(`Error fetching issues for board ${boardId}:`, error);
      }
    }

    return closedItems;
  }

  private async getBoardProject(boardId: string): Promise<string> {
    try {
      const response = await this.client.get(`/agile/1.0/board/${boardId}/configuration`);
      const projectId = response.data.filter?.projectId;

      if (projectId) {
        const projectResponse = await this.client.get(`/api/2/project/${projectId}`);
        return projectResponse.data.key;
      }

      return '';
    } catch (error) {
      console.error(`Error fetching board configuration for ${boardId}:`, error);
      return '';
    }
  }

  async getIssueDetails(issueKey: string): Promise<JiraIssue | null> {
    try {
      const response = await this.client.get(`/api/2/issue/${issueKey}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching issue ${issueKey}:`, error);
      return null;
    }
  }
}