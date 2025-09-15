import { InputValidator } from '../validators.js';

describe('InputValidator', () => {
  describe('validateBoardIds', () => {
    it('should accept valid board IDs', () => {
      const result = InputValidator.validateBoardIds(['123', 'board-456', 'BOARD_789']);
      expect(result).toEqual(['123', 'board-456', 'BOARD_789']);
    });

    it('should reject non-array input', () => {
      expect(() => InputValidator.validateBoardIds('123')).toThrow('boardIds must be an array');
    });

    it('should reject empty array', () => {
      expect(() => InputValidator.validateBoardIds([])).toThrow('boardIds cannot be empty');
    });

    it('should reject more than 10 boards', () => {
      const tooMany = Array(11).fill('board1');
      expect(() => InputValidator.validateBoardIds(tooMany)).toThrow('Cannot query more than 10 boards');
    });

    it('should reject invalid board ID format', () => {
      expect(() => InputValidator.validateBoardIds(['valid', 'in@valid']))
        .toThrow('Invalid board ID format: in@valid');
    });

    it('should trim whitespace from board IDs', () => {
      const result = InputValidator.validateBoardIds(['  123  ', 'board ']);
      expect(result).toEqual(['123', 'board']);
    });
  });

  describe('validateDays', () => {
    it('should accept valid day values', () => {
      expect(InputValidator.validateDays(7)).toBe(7);
      expect(InputValidator.validateDays('30')).toBe(30);
      expect(InputValidator.validateDays(1)).toBe(1);
      expect(InputValidator.validateDays(90)).toBe(90);
    });

    it('should reject non-numeric values', () => {
      expect(() => InputValidator.validateDays('abc')).toThrow('days must be a number');
    });

    it('should reject values less than 1', () => {
      expect(() => InputValidator.validateDays(0)).toThrow('days must be between 1 and 90');
      expect(() => InputValidator.validateDays(-5)).toThrow('days must be between 1 and 90');
    });

    it('should reject values greater than 90', () => {
      expect(() => InputValidator.validateDays(91)).toThrow('days must be between 1 and 90');
      expect(() => InputValidator.validateDays(1000)).toThrow('days must be between 1 and 90');
    });
  });

  describe('validateFormat', () => {
    it('should accept valid formats', () => {
      expect(InputValidator.validateFormat('blog')).toBe('blog');
      expect(InputValidator.validateFormat('announcement')).toBe('announcement');
      expect(InputValidator.validateFormat('both')).toBe('both');
    });

    it('should reject invalid formats', () => {
      expect(() => InputValidator.validateFormat('invalid'))
        .toThrow('Invalid format. Must be one of: blog, announcement, both');
    });
  });

  describe('sanitizeJiraResponse', () => {
    it('should remove script tags from strings', () => {
      const input = 'Hello <script>alert("XSS")</script> World';
      const result = InputValidator.sanitizeJiraResponse(input);
      expect(result).toBe('Hello  World');
    });

    it('should sanitize nested objects', () => {
      const input = {
        name: 'Test <script>alert("xss")</script>',
        nested: {
          value: 'Another <script src="evil.js"></script> test'
        }
      };
      const result = InputValidator.sanitizeJiraResponse(input);
      expect(result.name).toBe('Test ');
      expect(result.nested.value).toBe('Another  test');
    });

    it('should sanitize arrays', () => {
      const input = ['<script>alert(1)</script>', 'clean', '<script>alert(2)</script>'];
      const result = InputValidator.sanitizeJiraResponse(input);
      expect(result).toEqual(['', 'clean', '']);
    });

    it('should handle null and undefined', () => {
      expect(InputValidator.sanitizeJiraResponse(null)).toBeNull();
      expect(InputValidator.sanitizeJiraResponse(undefined)).toBeUndefined();
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('should redact URLs', () => {
      const input = { message: 'Error connecting to https://example.atlassian.net/rest/api' };
      const result = InputValidator.sanitizeErrorMessage(input);
      expect(result).toBe('Error connecting to [URL_REDACTED]');
    });

    it('should redact email addresses', () => {
      const input = { message: 'Authentication failed for user@example.com' };
      const result = InputValidator.sanitizeErrorMessage(input);
      expect(result).toBe('Authentication failed for [EMAIL_REDACTED]');
    });

    it('should redact API tokens', () => {
      const input = { message: 'Invalid api_token: abc123xyz789' };
      const result = InputValidator.sanitizeErrorMessage(input);
      expect(result).toBe('Invalid api_token: [REDACTED]');
    });

    it('should redact Bearer tokens', () => {
      const input = { message: 'Authorization failed: Bearer eyJhbGciOiJIUzI1NiIs...' };
      const result = InputValidator.sanitizeErrorMessage(input);
      expect(result).toBe('Authorization failed: Bearer [TOKEN_REDACTED]');
    });

    it('should handle non-string errors', () => {
      expect(InputValidator.sanitizeErrorMessage(null)).toBe('An error occurred');
      expect(InputValidator.sanitizeErrorMessage(undefined)).toBe('An error occurred');
      expect(InputValidator.sanitizeErrorMessage({ message: 'Test error' })).toBe('Test error');
    });
  });
});