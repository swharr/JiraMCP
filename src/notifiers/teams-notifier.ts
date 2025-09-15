import axios from 'axios';
import { JiraIssue } from '../jira-client-secure.js';
import { InputValidator } from '../validators.js';

export interface TeamsMessage {
  '@type': string;
  '@context': string;
  themeColor?: string;
  summary: string;
  sections?: any[];
  potentialAction?: any[];
}

export class TeamsNotifier {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    if (!webhookUrl) {
      throw new Error('Teams webhook URL is required');
    }

    // Validate webhook URL format
    if (!/^https:\/\/.*\.webhook\.office\.com\//.test(webhookUrl)) {
      throw new Error('Invalid Teams webhook URL format');
    }

    this.webhookUrl = webhookUrl;
  }

  async sendClosedItemsNotification(issues: JiraIssue[], boardName: string): Promise<void> {
    if (issues.length === 0) {
      return;
    }

    const message = this.buildClosedItemsMessage(issues, boardName);
    await this.send(message);
  }

  async sendBlogNotification(blogContent: string, issueCount: number): Promise<void> {
    const message = this.buildBlogMessage(blogContent, issueCount);
    await this.send(message);
  }

  private buildClosedItemsMessage(issues: JiraIssue[], boardName: string): TeamsMessage {
    const groupedIssues = this.groupIssuesByType(issues);
    const date = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    const sections: any[] = [
      {
        activityTitle: `Jira Board Update: ${boardName}`,
        activitySubtitle: `${date}`,
        activityImage: 'https://cdn.worldvectorlogo.com/logos/jira-1.svg',
        facts: [
          {
            name: 'Total Completed',
            value: `${issues.length} items`
          },
          {
            name: 'Period',
            value: 'Last 7 days'
          }
        ]
      }
    ];

    // Add breakdown by type
    const facts: any[] = [];
    for (const [type, typeIssues] of groupedIssues.entries()) {
      facts.push({
        name: type,
        value: `${typeIssues.length} items`
      });
    }

    if (facts.length > 0) {
      sections.push({
        activityTitle: 'Breakdown by Type',
        facts
      });
    }

    // Add top issues
    const topIssues = issues.slice(0, 5);
    if (topIssues.length > 0) {
      const issuesList = topIssues
        .map(issue => `• **${issue.key}**: ${this.truncate(issue.fields.summary, 50)}`)
        .join('<br/>');

      sections.push({
        activityTitle: 'Recent Completions',
        text: issuesList,
        markdown: true
      });
    }

    // Add contributors section
    const contributors = this.getContributors(issues);
    if (contributors.length > 0) {
      sections.push({
        activityTitle: 'Contributors',
        text: contributors.slice(0, 10).join(', ')
      });
    }

    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor: '0078D4',
      summary: `Jira Update: ${issues.length} items completed in ${boardName}`,
      sections,
      potentialAction: [
        {
          '@type': 'OpenUri',
          name: 'View in Jira',
          targets: [
            {
              os: 'default',
              uri: `https://your-domain.atlassian.net/jira/software/projects/${boardName}/boards`
            }
          ]
        }
      ]
    };
  }

  private buildBlogMessage(blogContent: string, issueCount: number): TeamsMessage {
    // Extract title and summary
    const titleMatch = blogContent.match(/^# (.+)$/m);
    const title = titleMatch ? titleMatch[1] : 'Product Update';

    const summary = this.truncate(
      blogContent.replace(/^#.*$/gm, '').replace(/\*/g, '').trim(),
      500
    );

    const sections = [
      {
        activityTitle: '📝 Blog Post Generated',
        activitySubtitle: title,
        activityImage: 'https://cdn-icons-png.flaticon.com/512/4922/4922073.png',
        facts: [
          {
            name: 'Items Included',
            value: `${issueCount}`
          },
          {
            name: 'Generated At',
            value: new Date().toLocaleString()
          }
        ]
      },
      {
        activityTitle: 'Preview',
        text: summary,
        markdown: true
      }
    ];

    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor: '00C853',
      summary: `New blog post generated: ${title}`,
      sections,
      potentialAction: [
        {
          '@type': 'ActionCard',
          name: 'Actions',
          inputs: [],
          actions: [
            {
              '@type': 'OpenUri',
              name: 'View Full Post',
              targets: [
                {
                  os: 'default',
                  uri: 'https://your-domain.com/blog/draft'
                }
              ]
            },
            {
              '@type': 'OpenUri',
              name: 'Edit in CMS',
              targets: [
                {
                  os: 'default',
                  uri: 'https://your-domain.com/admin/posts/edit'
                }
              ]
            }
          ]
        }
      ]
    };
  }

  async sendSecurityAlert(title: string, details: string, severity: 'low' | 'medium' | 'high' | 'critical'): Promise<void> {
    const colorMap = {
      low: '00C853',
      medium: 'FFC107',
      high: 'FF9800',
      critical: 'F44336'
    };

    const message: TeamsMessage = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      themeColor: colorMap[severity],
      summary: `Security Alert: ${title}`,
      sections: [
        {
          activityTitle: '⚠️ Security Alert',
          activitySubtitle: title,
          facts: [
            {
              name: 'Severity',
              value: severity.toUpperCase()
            },
            {
              name: 'Time',
              value: new Date().toISOString()
            }
          ]
        },
        {
          activityTitle: 'Details',
          text: details,
          markdown: true
        }
      ],
      potentialAction: [
        {
          '@type': 'OpenUri',
          name: 'View Security Dashboard',
          targets: [
            {
              os: 'default',
              uri: 'https://github.com/your-org/jira-mcp-server/security'
            }
          ]
        }
      ]
    };

    await this.send(message);
  }

  private async send(message: TeamsMessage): Promise<void> {
    try {
      const response = await axios.post(this.webhookUrl, message, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
        validateStatus: (status) => status < 500
      });

      if (response.status !== 200) {
        throw new Error(`Teams API returned status ${response.status}: ${response.data}`);
      }

      if (response.data !== '1') {
        throw new Error(`Teams API returned unexpected response: ${response.data}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to send Teams notification: ${InputValidator.sanitizeErrorMessage(message)}`);
    }
  }

  private groupIssuesByType(issues: JiraIssue[]): Map<string, JiraIssue[]> {
    const grouped = new Map<string, JiraIssue[]>();

    for (const issue of issues) {
      const type = issue.fields.issuetype.name;
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }
      grouped.get(type)!.push(issue);
    }

    return grouped;
  }

  private getContributors(issues: JiraIssue[]): string[] {
    const contributors = new Set<string>();

    for (const issue of issues) {
      if (issue.fields.assignee?.displayName) {
        contributors.add(issue.fields.assignee.displayName);
      }
    }

    return Array.from(contributors).sort();
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
}