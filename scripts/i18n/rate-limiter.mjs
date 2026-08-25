/**
 * Sequential rate limiter for build-time translation API calls.
 */
export function createRateLimiter(minIntervalMs) {
  let lastAt = 0;
  const interval = Math.max(0, Number(minIntervalMs) || 0);
  return {
    async wait() {
      if (!interval) return;
      const now = Date.now();
      const elapsed = now - lastAt;
      if (elapsed < interval) {
        await sleep(interval - elapsed);
      }
      lastAt = Date.now();
    },
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Global GTX request gate — one interval between request starts across all parallel workers. */
let sharedGtxGate = null;

export function getSharedGtxGate(minIntervalMs) {
  const interval = Math.max(0, Number(minIntervalMs) || 0);
  if (!sharedGtxGate || sharedGtxGate.interval !== interval) {
    sharedGtxGate = { interval, chain: Promise.resolve(), lastAt: 0 };
  }
  return sharedGtxGate;
}

export async function acquireGtxSlot(minIntervalMs) {
  const gate = getSharedGtxGate(minIntervalMs);
  const prev = gate.chain;
  let release;
  gate.chain = new Promise((resolve) => {
    release = resolve;
  });
  await prev;
  const now = Date.now();
  const wait = Math.max(0, gate.lastAt + gate.interval - now);
  if (wait) await sleep(wait);
  gate.lastAt = Date.now();
  return () => release();
}

export function resetSharedGtxGate() {
  sharedGtxGate = null;
}

export async function withRetry(fn, { maxRetries = 3, baseDelayMs = 1000 } = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await fn(attempt);
    } catch (err) {
      attempt += 1;
      const retryable =
        err?.retryable === true ||
        err?.status === 429 ||
        (err?.status >= 500 && err?.status < 600);
      if (!retryable || attempt > maxRetries) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }
}
