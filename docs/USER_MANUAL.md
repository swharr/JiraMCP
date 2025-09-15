# Jira MCP Server User Manual

## Overview

The Jira MCP Server enables Claude to interact with your Jira instance, automatically generating blog posts and announcements from closed tickets. This manual covers daily usage, best practices, and common workflows.

## Available Commands

### 1. List All Boards
**Purpose:** Discover available Jira boards in your instance

**Usage in Claude:**
```
Use the jira-mcp get_boards tool to list all available boards
```

**Example Response:**
```json
[
  { "id": 1, "name": "Product Development", "type": "scrum" },
  { "id": 2, "name": "Marketing Team", "type": "kanban" },
  { "id": 3, "name": "Bug Tracking", "type": "scrum" }
]
```

### 2. Get Closed Items
**Purpose:** Retrieve recently completed work items from specific boards

**Usage in Claude:**
```
Use the jira-mcp get_closed_items tool with boardIds ["1", "2"] for the last 7 days
```

**Parameters:**
- `boardIds` (required): Array of board IDs to check
- `days` (optional): Number of days to look back (1-90, default: 7)

**Example Response:**
```json
[
  {
    "key": "PROJ-123",
    "fields": {
      "summary": "Implement user authentication",
      "status": { "name": "Done" },
      "issuetype": { "name": "Story" },
      "assignee": { "displayName": "Jane Doe" },
      "resolutiondate": "2024-01-15"
    }
  }
]
```

### 3. Generate Blog/Announcement
**Purpose:** Create formatted content for stakeholder communications

**Usage in Claude:**
```
Generate a blog post for the PMM team using jira-mcp scaffold_announcement
with board IDs ["1"] for the last 14 days in both formats
```

**Parameters:**
- `boardIds` (required): Array of board IDs
- `days` (optional): Lookback period (default: 7)
- `format` (optional): "blog", "announcement", or "both" (default: "both")

## Common Workflows

### Weekly Sprint Review

**Scenario:** Generate a sprint review summary every Friday

1. **Get the sprint board ID:**
```
List all boards using jira-mcp get_boards
```

2. **Review closed items:**
```
Show me items closed in board 1 during the last 7 days
```

3. **Generate announcement:**
```
Create a sprint review announcement for board 1
```

### Monthly Product Update

**Scenario:** Create a comprehensive monthly update for stakeholders

1. **Gather data from multiple boards:**
```
Get closed items from boards 1, 2, and 3 for the last 30 days
```

2. **Generate blog post:**
```
Create a blog post format announcement for boards ["1", "2", "3"] covering the last 30 days
```

3. **Review and edit:**
```
The generated content will include:
- Executive summary
- Feature highlights
- Bug fixes
- Technical improvements
- Team recognition
```

### Bug Fix Release Notes

**Scenario:** Document bug fixes for a patch release

1. **Filter bug tracking board:**
```
Get closed items from the bug tracking board (ID: 3) for the last 14 days
```

2. **Generate focused announcement:**
```
Create an announcement focusing on bug fixes from board 3
```

## Output Formats

### Blog Format
Ideal for: Public-facing updates, company newsletters, detailed documentation

**Structure:**
```markdown
# Product Updates - [Date]

## New Features & Enhancements
- Detailed descriptions
- User impact
- Implementation notes

## Bug Fixes
- Issue summaries
- Resolution details

## Technical Improvements
- Backend optimizations
- Performance enhancements

## What's Next?
- Forward-looking statement
- Call to action
```

### Announcement Format
Ideal for: Slack/Teams posts, executive summaries, quick updates

**Structure:**
```markdown
# PMM Release Announcement - [Date]

## Key Highlights
- Top 3-5 achievements
- Business impact

## Summary Statistics
- Total items: X
- Features: Y
- Bugs fixed: Z

## Team Recognition
- Contributors list
- Special mentions
```

### Both Format
Provides both versions sequentially, separated by a divider

## Best Practices

### 1. Board Selection
- **DO:** Group related boards for comprehensive updates
- **DO:** Use consistent board sets for regular reports
- **DON'T:** Mix unrelated projects in one announcement

### 2. Time Periods
- **Weekly updates:** Use 7 days for sprint reviews
- **Bi-weekly updates:** Use 14 days for iteration summaries
- **Monthly updates:** Use 30 days for comprehensive reviews
- **Quarterly updates:** Use 90 days (maximum) for strategic reviews

### 3. Content Customization

After generating content, you can ask Claude to:

```
Please adjust the blog post to:
- Emphasize the authentication feature
- Add more technical details for the engineering audience
- Include migration notes for existing users
```

### 4. Distribution Strategy

| Audience | Format | Frequency | Channels |
|----------|--------|-----------|----------|
| Executives | Announcement | Monthly | Email, Teams |
| Customers | Blog | Bi-weekly | Website, Newsletter |
| Engineers | Both | Weekly | Slack, Wiki |
| Stakeholders | Announcement | Sprint-end | Teams, Email |

## Advanced Usage

### Filtering by Project Type

If you have `JIRA_ALLOWED_PROJECTS` configured, only those projects will be accessible:

```env
JIRA_ALLOWED_PROJECTS=PROD,MARK,INFRA
```

This ensures:
- Security through project isolation
- Focused content generation
- Compliance with data access policies

### Combining Multiple Boards

Generate comprehensive updates across teams:

```
Create a company-wide product update using boards 1, 2, 5, and 8 for the last month
```

### Custom Formatting Requests

After generation, refine the output:

```
Take the generated blog post and:
1. Add a table of contents
2. Include JIRA ticket links
3. Format for WordPress
4. Add social media snippets
```

## Integration Examples

### Slack Workflow

1. **Generate content:**
```
Create an announcement for board 1
```

2. **Post to Slack:**
```
The content is automatically formatted for Slack with:
- Rich text formatting
- Emoji indicators
- Clickable JIRA links
- Thread summaries
```

### Email Newsletter

1. **Generate blog format:**
```
Create a blog post for boards 1 and 2 covering 2 weeks
```

2. **Request HTML conversion:**
```
Convert this blog post to HTML email format with:
- Responsive design
- CTA buttons
- Company branding
```

### Confluence Documentation

1. **Generate comprehensive update:**
```
Create both blog and announcement formats for all product boards
```

2. **Format for Confluence:**
```
Reformat this content for Confluence with:
- Proper macros
- Page hierarchy
- Cross-references
```

## Tips & Tricks

### 1. Quick Status Checks
```
Show me what was completed yesterday in board 1
```

### 2. Team Performance
```
Generate a summary highlighting individual contributors from board 2 last month
```

### 3. Feature Focus
```
Create an announcement emphasizing only new features from boards 1 and 3
```

### 4. Executive Briefing
```
Create a one-paragraph executive summary of all closed items this week
```

### 5. Release Notes
```
Generate technical release notes from board 1 grouped by component
```

## Troubleshooting Common Issues

### No Items Found
**Possible causes:**
- No items closed in the specified period
- Wrong board ID
- Permission issues

**Solution:**
```
1. Verify board ID with get_boards
2. Extend the time period
3. Check project permissions
```

### Incomplete Data
**Possible causes:**
- API rate limiting
- Network timeout
- Large result sets

**Solution:**
```
1. Reduce number of boards
2. Shorten time period
3. Try again after a minute
```

### Format Issues
**Possible causes:**
- Special characters in JIRA data
- Very long descriptions
- Missing fields

**Solution:**
```
The system automatically:
- Sanitizes HTML/scripts
- Truncates long content
- Handles missing fields gracefully
```

## Keyboard Shortcuts in Claude

When working with generated content:
- `Cmd/Ctrl + A`: Select all content
- `Cmd/Ctrl + C`: Copy for pasting elsewhere
- Use Claude's copy button for code blocks

## Performance Tips

1. **Batch Operations:** Request multiple boards in one command
2. **Optimal Time Periods:** Use 7-14 days for best performance
3. **Scheduled Generation:** Run during off-peak hours
4. **Cache Utilization:** Repeated requests within 15 minutes use cached data

## Security Notes

- API tokens are never exposed in generated content
- All error messages are sanitized
- Rate limiting prevents abuse
- Project-level access control available

## Getting More Help

- **Quick help:** Ask Claude "How do I use the Jira MCP tools?"
- **Documentation:** Refer to [Setup Guide](SETUP_GUIDE.md)
- **Examples:** Request "Show me example Jira MCP commands"
- **Support:** Check [Troubleshooting](#troubleshooting-common-issues)

## Feedback and Improvement

To improve the generated content, provide feedback to Claude:

```
The blog post is good but please:
- Make it more technical
- Add metrics and KPIs
- Include a lessons learned section
```

Claude will refine the output based on your preferences and can remember your preferences for future generations.