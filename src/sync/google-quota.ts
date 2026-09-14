export class GoogleQuota {
  private tail: Promise<unknown> = Promise.resolve();
  private last = { read: 0, write: 0 };
  run<T>(kind: "read" | "write", operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(async () => {
      for (let attempt = 0; ; attempt++) {
        const delay = Math.max(0, this.last[kind] + 1500 - Date.now());
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        this.last[kind] = Date.now();
        try { return await operation(); } catch (error) {
          const e = error as { code?: number; status?: number;
            response?: { status?: number; headers?: { get?: (name: string) => string | null } } };
          const status = Number(e.response?.status ?? e.status ?? e.code);
          if (![429, 500, 502, 503, 504].includes(status) || attempt >= 3) throw error;
          const retry = e.response?.headers?.get?.("retry-after");
          const seconds = Number(retry);
          const retryMs = retry ? (Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retry) - Date.now()) : 0;
          // Long Retry-After is delegated to the persistent job backoff.
          if (retryMs > 60_000) throw Object.assign(
            error instanceof Error ? error : new Error("Google quota requires a later retry"),
            { retryAfterMs: retryMs });
          await new Promise(resolve => setTimeout(resolve,
            Math.max(retryMs || 0, Math.min(32_000, 1000 * 2 ** attempt) + Math.random() * 1000)));
        }
      }
    });
    this.tail = result.catch(() => undefined);
    return result;
  }
}
