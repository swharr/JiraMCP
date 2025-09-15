import { SlackNotifier } from '../notifiers/slack-notifier';
import { TeamsNotifier } from '../notifiers/teams-notifier';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SlackNotifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid webhook URL', () => {
      const notifier = new SlackNotifier('https://hooks.slack.com/services/T123/B456/xyz');
      expect(notifier).toBeDefined();
    });

    it('should throw error for invalid webhook URL', () => {
      expect(() => new SlackNotifier('https://invalid.com/webhook'))
        .toThrow('Invalid Slack webhook URL format');
    });

    it('should throw error for missing webhook URL', () => {
      expect(() => new SlackNotifier(''))
        .toThrow('Slack webhook URL is required');
    });
  });

  describe('sendClosedItemsNotification', () => {
    it('should send notification for closed items', async () => {
      mockedAxios.post.mockResolvedValue({ data: 'ok' });

      const notifier = new SlackNotifier('https://hooks.slack.com/services/T123/B456/xyz');
      const mockIssues = [
        {
          id: '1',
          key: 'PROJ-123',
          fields: {
            summary: 'Test issue',
            issuetype: { name: 'Bug' },
            status: { name: 'Done' },
            created: '2024-01-01',
            updated: '2024-01-02'
          }
        }
      ];

      await notifier.sendClosedItemsNotification(mockIssues as any, 'Test Board');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/T123/B456/xyz',
        expect.objectContaining({
          blocks: expect.any(Array),
          username: 'Jira MCP Bot'
        }),
        expect.any(Object)
      );
    });

    it('should not send notification for empty issues array', async () => {
      const notifier = new SlackNotifier('https://hooks.slack.com/services/T123/B456/xyz');
      await notifier.sendClosedItemsNotification([], 'Test Board');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));

      const notifier = new SlackNotifier('https://hooks.slack.com/services/T123/B456/xyz');
      const mockIssues = [{ id: '1', key: 'PROJ-123', fields: {} }];

      await expect(notifier.sendClosedItemsNotification(mockIssues as any, 'Test Board'))
        .rejects.toThrow('Failed to send Slack notification');
    });
  });
});

describe('TeamsNotifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with valid webhook URL', () => {
      const notifier = new TeamsNotifier('https://outlook.office.com/webhook/abc123');
      expect(notifier).toBeDefined();
    });

    it('should throw error for invalid webhook URL', () => {
      expect(() => new TeamsNotifier('https://invalid.com/webhook'))
        .toThrow('Invalid Teams webhook URL format');
    });

    it('should throw error for missing webhook URL', () => {
      expect(() => new TeamsNotifier(''))
        .toThrow('Teams webhook URL is required');
    });
  });

  describe('sendClosedItemsNotification', () => {
    it('should send notification for closed items', async () => {
      mockedAxios.post.mockResolvedValue({ data: '1', status: 200 });

      const notifier = new TeamsNotifier('https://outlook.office.com/webhook/abc123');
      const mockIssues = [
        {
          id: '1',
          key: 'PROJ-123',
          fields: {
            summary: 'Test issue',
            issuetype: { name: 'Story' },
            status: { name: 'Done' },
            assignee: { displayName: 'John Doe' },
            created: '2024-01-01',
            updated: '2024-01-02'
          }
        }
      ];

      await notifier.sendClosedItemsNotification(mockIssues as any, 'Test Board');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://outlook.office.com/webhook/abc123',
        expect.objectContaining({
          '@type': 'MessageCard',
          '@context': 'https://schema.org/extensions',
          themeColor: '0078D4',
          summary: expect.any(String),
          sections: expect.any(Array)
        }),
        expect.any(Object)
      );
    });

    it('should not send notification for empty issues array', async () => {
      const notifier = new TeamsNotifier('https://outlook.office.com/webhook/abc123');
      await notifier.sendClosedItemsNotification([], 'Test Board');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('sendSecurityAlert', () => {
    it('should send security alert with correct severity color', async () => {
      mockedAxios.post.mockResolvedValue({ data: '1', status: 200 });

      const notifier = new TeamsNotifier('https://outlook.office.com/webhook/abc123');
      await notifier.sendSecurityAlert('Test Alert', 'Security issue detected', 'critical');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://outlook.office.com/webhook/abc123',
        expect.objectContaining({
          themeColor: 'F44336', // Critical severity color
          summary: 'Security Alert: Test Alert'
        }),
        expect.any(Object)
      );
    });

    it('should use correct colors for different severities', async () => {
      mockedAxios.post.mockResolvedValue({ data: '1', status: 200 });
      const notifier = new TeamsNotifier('https://outlook.office.com/webhook/abc123');

      const severities: Array<['low' | 'medium' | 'high' | 'critical', string]> = [
        ['low', '00C853'],
        ['medium', 'FFC107'],
        ['high', 'FF9800'],
        ['critical', 'F44336']
      ];

      for (const [severity, color] of severities) {
        await notifier.sendSecurityAlert('Test', 'Details', severity);
        expect(mockedAxios.post).toHaveBeenLastCalledWith(
          expect.any(String),
          expect.objectContaining({ themeColor: color }),
          expect.any(Object)
        );
      }
    });
  });
});