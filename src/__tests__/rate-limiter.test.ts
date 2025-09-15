import { RateLimiter } from '../rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(3, 1000); // 3 requests per second for testing
  });

  it('should allow requests within limit', () => {
    expect(rateLimiter.isAllowed('user1')).toBe(true);
    expect(rateLimiter.isAllowed('user1')).toBe(true);
    expect(rateLimiter.isAllowed('user1')).toBe(true);
  });

  it('should block requests exceeding limit', () => {
    expect(rateLimiter.isAllowed('user1')).toBe(true);
    expect(rateLimiter.isAllowed('user1')).toBe(true);
    expect(rateLimiter.isAllowed('user1')).toBe(true);
    expect(rateLimiter.isAllowed('user1')).toBe(false);
  });

  it('should track different keys independently', () => {
    expect(rateLimiter.isAllowed('user1')).toBe(true);
    expect(rateLimiter.isAllowed('user1')).toBe(true);
    expect(rateLimiter.isAllowed('user1')).toBe(true);
    expect(rateLimiter.isAllowed('user1')).toBe(false);

    expect(rateLimiter.isAllowed('user2')).toBe(true);
    expect(rateLimiter.isAllowed('user2')).toBe(true);
  });

  it('should allow requests after time window', (done) => {
    expect(rateLimiter.isAllowed('user1')).toBe(true);
    expect(rateLimiter.isAllowed('user1')).toBe(true);
    expect(rateLimiter.isAllowed('user1')).toBe(true);
    expect(rateLimiter.isAllowed('user1')).toBe(false);

    setTimeout(() => {
      expect(rateLimiter.isAllowed('user1')).toBe(true);
      done();
    }, 1100);
  });

  it('should reset limits for a specific key', () => {
    expect(rateLimiter.isAllowed('user1')).toBe(true);
    expect(rateLimiter.isAllowed('user1')).toBe(true);
    expect(rateLimiter.isAllowed('user1')).toBe(true);
    expect(rateLimiter.isAllowed('user1')).toBe(false);

    rateLimiter.reset('user1');
    expect(rateLimiter.isAllowed('user1')).toBe(true);
  });

  it('should handle cleanup of old entries', () => {
    // Force cleanup by setting Math.random to return a low value
    const originalRandom = Math.random;
    Math.random = () => 0.001;

    rateLimiter.isAllowed('user1');
    rateLimiter.cleanup(); // Manually trigger cleanup

    Math.random = originalRandom;
  });

  it('should handle custom rate limits', () => {
    const customLimiter = new RateLimiter(10, 5000); // 10 requests per 5 seconds

    for (let i = 0; i < 10; i++) {
      expect(customLimiter.isAllowed('test')).toBe(true);
    }
    expect(customLimiter.isAllowed('test')).toBe(false);
  });
});