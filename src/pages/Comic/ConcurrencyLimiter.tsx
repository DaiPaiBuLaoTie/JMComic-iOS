class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => void> = [];
  constructor(private max: number) {}

  // isStale 排到才檢查:排隊期間已取消的頁面不用白做
  async run<T>(task: () => T | Promise<T>, isStale?: () => boolean): Promise<T | undefined> {
    if (isStale?.()) return undefined;
    if (this.running >= this.max) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.running++;
    try {
      if (isStale?.()) return undefined;
      return await task(); // await 一個非 Promise 值也沒問題,JS/TS 都支援
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}
export const scrambleLimiter = new ConcurrencyLimiter(2);
