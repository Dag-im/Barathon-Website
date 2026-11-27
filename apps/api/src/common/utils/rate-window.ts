/** Fixed-window in-memory counter used for the named limits that the throttler cannot express. */
export class RateWindow {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  /** Records a hit and returns false when the key is over its limit. */
  hit(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    list.push(now);
    this.hits.set(key, list);
    return list.length <= this.limit;
  }

  /** Seconds until the oldest hit leaves the window. */
  retryAfter(key: string, now = Date.now()): number {
    const list = this.hits.get(key) ?? [];
    if (!list.length) return 0;
    return Math.max(1, Math.ceil((list[0] + this.windowMs - now) / 1000));
  }

  reset(): void {
    this.hits.clear();
  }
}
