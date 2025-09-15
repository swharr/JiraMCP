import { JiraIssue } from './jira-client-secure.js';

export class BlogScaffolder {
  generateContent(issues: JiraIssue[], format: 'blog' | 'announcement' | 'both'): string {
    if (issues.length === 0) {
      return 'No closed items found in the specified time period.';
    }

    const groupedIssues = this.groupIssuesByType(issues);
    let content = '';

    if (format === 'blog' || format === 'both') {
      content += this.generateBlogPost(groupedIssues, issues);
      if (format === 'both') {
        content += '\n\n---\n\n';
      }
    }

    if (format === 'announcement' || format === 'both') {
      content += this.generateAnnouncement(groupedIssues, issues);
    }

    return content;
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

  private generateBlogPost(groupedIssues: Map<string, JiraIssue[]>, allIssues: JiraIssue[]): string {
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let blog = `# Product Updates - ${date}\n\n`;
    blog += `We're excited to share the latest updates from our PMM organization. This week, we've completed ${allIssues.length} items across our product portfolio.\n\n`;

    const features = groupedIssues.get('Story') || [];
    const bugs = groupedIssues.get('Bug') || [];
    const tasks = groupedIssues.get('Task') || [];
    const epics = groupedIssues.get('Epic') || [];

    if (features.length > 0 || epics.length > 0) {
      blog += `## 🚀 New Features & Enhancements\n\n`;

      if (epics.length > 0) {
        blog += `### Major Initiatives Completed\n\n`;
        for (const epic of epics) {
          blog += this.formatIssueForBlog(epic);
        }
      }

      if (features.length > 0) {
        blog += `### Feature Updates\n\n`;
        for (const feature of features) {
          blog += this.formatIssueForBlog(feature);
        }
      }
    }

    if (bugs.length > 0) {
      blog += `## 🐛 Bug Fixes\n\n`;
      blog += `We've resolved ${bugs.length} issues to improve stability and performance:\n\n`;
      for (const bug of bugs) {
        blog += this.formatIssueForBlog(bug, true);
      }
    }

    if (tasks.length > 0) {
      blog += `## 🔧 Technical Improvements\n\n`;
      for (const task of tasks) {
        blog += this.formatIssueForBlog(task, true);
      }
    }

    blog += `\n## What's Next?\n\n`;
    blog += `Stay tuned for more updates as we continue to enhance our products and services. If you have any questions or feedback, please reach out to the PMM team.\n\n`;

    blog += `---\n\n`;
    blog += `*This update was generated from Jira closed items. For detailed information, please refer to your Jira dashboard.*\n`;

    return blog;
  }

  private generateAnnouncement(groupedIssues: Map<string, JiraIssue[]>, allIssues: JiraIssue[]): string {
    const date = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    let announcement = `# 📢 PMM Release Announcement - ${date}\n\n`;

    const features = groupedIssues.get('Story') || [];
    const epics = groupedIssues.get('Epic') || [];
    const topFeatures = [...epics, ...features].slice(0, 5);

    if (topFeatures.length > 0) {
      announcement += `## Key Highlights\n\n`;
      for (const feature of topFeatures) {
        announcement += `### ${feature.fields.summary}\n`;
        if (feature.fields.description) {
          const description = this.truncateDescription(feature.fields.description, 200);
          announcement += `${description}\n\n`;
        }
        announcement += `**Status:** Completed | **ID:** ${feature.key}\n\n`;
      }
    }

    announcement += `## Summary\n\n`;
    announcement += `- **Total Items Completed:** ${allIssues.length}\n`;
    announcement += `- **Features Delivered:** ${features.length + epics.length}\n`;
    announcement += `- **Bugs Fixed:** ${(groupedIssues.get('Bug') || []).length}\n`;
    announcement += `- **Technical Tasks:** ${(groupedIssues.get('Task') || []).length}\n\n`;

    announcement += `## Team Recognition\n\n`;
    const contributors = this.getContributors(allIssues);
    if (contributors.length > 0) {
      announcement += `Special thanks to our team members who contributed to this release:\n\n`;
      for (const contributor of contributors) {
        announcement += `- ${contributor}\n`;
      }
    }

    announcement += `\n## More Information\n\n`;
    announcement += `For detailed release notes and documentation, please visit your Jira dashboard or contact the PMM team.\n\n`;
    announcement += `**Questions?** Reach out to the PMM organization on Slack or via email.\n`;

    return announcement;
  }

  private formatIssueForBlog(issue: JiraIssue, compact: boolean = false): string {
    if (compact) {
      return `- **${issue.fields.summary}** (${issue.key})\n`;
    }

    let formatted = `#### ${issue.fields.summary}\n\n`;

    if (issue.fields.description) {
      const description = this.truncateDescription(issue.fields.description, 300);
      formatted += `${description}\n\n`;
    }

    formatted += `*Issue: ${issue.key}`;
    if (issue.fields.assignee) {
      formatted += ` | Completed by: ${issue.fields.assignee.displayName}`;
    }
    formatted += `*\n\n`;

    return formatted;
  }

  private truncateDescription(description: string, maxLength: number): string {
    const cleaned = description
      .replace(/\{[^}]*\}/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    return cleaned.substring(0, maxLength) + '...';
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
}
