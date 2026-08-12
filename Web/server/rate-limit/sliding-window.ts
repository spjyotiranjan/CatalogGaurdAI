import "server-only";

type Bucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private operationsSinceSweep = 0;

  constructor(
    private readonly windowMs: number,
    private readonly limit: number,
  ) {}

  consume(key: string, now = Date.now()): RateLimitResult {
    this.operationsSinceSweep += 1;
    if (this.operationsSinceSweep >= 1_000) {
      for (const [bucketKey, bucket] of this.buckets) {
        if (bucket.resetAt <= now) {
          this.buckets.delete(bucketKey);
        }
      }
      this.operationsSinceSweep = 0;
    }

    const current = this.buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + this.windowMs }
      : current;

    if (bucket.count >= this.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }

    bucket.count += 1;
    this.buckets.set(key, bucket);

    return {
      allowed: true,
      remaining: Math.max(0, this.limit - bucket.count),
      retryAfterSeconds: 0,
    };
  }

  resetForTests(): void {
    this.buckets.clear();
    this.operationsSinceSweep = 0;
  }
}
