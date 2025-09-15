export class InputValidator {
  static validateBoardIds(boardIds: any): string[] {
    if (!Array.isArray(boardIds)) {
      throw new Error('boardIds must be an array');
    }

    if (boardIds.length === 0) {
      throw new Error('boardIds cannot be empty');
    }

    if (boardIds.length > 10) {
      throw new Error('Cannot query more than 10 boards at once');
    }

    return boardIds.map(id => {
      const sanitized = String(id).trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
        throw new Error(`Invalid board ID format: ${sanitized}`);
      }
      return sanitized;
    });
  }

  static validateDays(days: any): number {
    const parsed = parseInt(days, 10);

    if (isNaN(parsed)) {
      throw new Error('days must be a number');
    }

    if (parsed < 1 || parsed > 90) {
      throw new Error('days must be between 1 and 90');
    }

    return parsed;
  }

  static validateFormat(format: any): 'blog' | 'announcement' | 'both' {
    const validFormats = ['blog', 'announcement', 'both'];

    if (!validFormats.includes(format)) {
      throw new Error(`Invalid format. Must be one of: ${validFormats.join(', ')}`);
    }

    return format as 'blog' | 'announcement' | 'both';
  }

  static sanitizeJiraResponse(data: any): any {
    if (typeof data === 'string') {
      return data.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeJiraResponse(item));
    }

    if (data && typeof data === 'object') {
      const sanitized: any = {};
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          sanitized[key] = this.sanitizeJiraResponse(data[key]);
        }
      }
      return sanitized;
    }

    return data;
  }

  static sanitizeErrorMessage(error: any): string {
    const message = error?.message || 'An error occurred';

    // Remove sensitive information from error messages
    return message
      .replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]')
      .replace(/Bearer\s+[^\s]+/g, 'Bearer [TOKEN_REDACTED]')
      .replace(/api[_-]?token[:\s]+[^\s]+/gi, 'api_token: [REDACTED]');
  }
}