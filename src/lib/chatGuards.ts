import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { logEvent } from "./logger";

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15_000);
const MAX_REQUESTS_PER_WINDOW = Number(
  process.env.RATE_LIMIT_MAX_REQUESTS ?? 10
);
const CIRCUIT_COOLDOWN_MS = Number(
  process.env.CIRCUIT_COOLDOWN_MS ?? 30_000
);
const CIRCUIT_MAX_FAILURES = Number(
  process.env.CIRCUIT_FAILURE_THRESHOLD ?? 5
);

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const allowMemoryFallback =
  process.env.RATE_LIMIT_ALLOW_MEMORY === "true" ||
  process.env.NODE_ENV !== "production";

if ((!redisUrl || !redisToken) && !allowMemoryFallback) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN devem estar configuradas para o rate limiting em produção."
  );
}

const redisClient = redisUrl && redisToken
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

const ratelimit = redisClient
  ? new Ratelimit({
      redis: redisClient,
      limiter: Ratelimit.slidingWindow(
        MAX_REQUESTS_PER_WINDOW,
        `${Math.ceil(WINDOW_MS / 1000)} s`
      ),
      analytics: true,
      prefix: "chatbot-rate",
    })
  : null;

const CIRCUIT_FAILURE_KEY = "chatbot:circuit:failures";
const CIRCUIT_FAILURE_TS_KEY = "chatbot:circuit:lastFailure";

const MEMORY_MAX_KEYS = Number(process.env.RATE_LIMIT_MEMORY_MAX_KEYS ?? 1000);

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

const circuitMemory = {
  failures: 0,
  lastFailureAt: 0,
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterMs?: number;
};

const getRetryAfter = (reset: number) =>
  reset > Date.now() ? reset - Date.now() : 0;

const pruneMemoryBuckets = () => {
  if (!memoryBuckets.size) return;

  const now = Date.now();
  for (const [key, bucket] of memoryBuckets) {
    if (bucket.resetAt <= now) {
      memoryBuckets.delete(key);
    }
  }

  if (memoryBuckets.size <= MEMORY_MAX_KEYS) return;

  const excess = memoryBuckets.size - MEMORY_MAX_KEYS;
  const iterator = memoryBuckets.keys();
  for (let i = 0; i < excess; i += 1) {
    const key = iterator.next().value;
    if (key === undefined) break;
    memoryBuckets.delete(key);
  }
};

const shouldUseMemory = !redisClient && allowMemoryFallback;

const applyMemoryRateLimit = (
  identifier: string,
  { forced }: { forced: boolean } = { forced: false }
): RateLimitResult => {
  if (!allowMemoryFallback && !forced) {
    return { allowed: true };
  }

  if (forced && !allowMemoryFallback) {
    logEvent("chat_rate_guard_error", {
      level: "warn",
      payload: {
        reason: "redis_unavailable_fallback",
        identifier,
      },
    });
  }

  pruneMemoryBuckets();

  const now = Date.now();
  const bucket = memoryBuckets.get(identifier);

  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(identifier, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return { allowed: true };
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    logEvent("rate_limit_blocked", {
      level: "warn",
      payload: { identifier, remaining: 0, reset: bucket.resetAt },
    });
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { allowed: true };
};

const isMemoryCircuitTripped = () => {
  if (circuitMemory.failures < CIRCUIT_MAX_FAILURES) {
    return false;
  }

  const now = Date.now();

  if (now - circuitMemory.lastFailureAt <= CIRCUIT_COOLDOWN_MS) {
    return true;
  }

  circuitMemory.failures = 0;
  circuitMemory.lastFailureAt = 0;
  return false;
};

const recordMemoryFailure = () => {
  circuitMemory.failures += 1;
  circuitMemory.lastFailureAt = Date.now();
};

export const ensureRateLimit = async (
  identifier: string
): Promise<RateLimitResult> => {
  if (ratelimit) {
    try {
      const result = await ratelimit.limit(`chat:${identifier}`);

      if (!result.success) {
        logEvent("rate_limit_blocked", {
          level: "warn",
          payload: {
            identifier,
            remaining: result.remaining,
            reset: result.reset,
          },
        });
        return { allowed: false, retryAfterMs: getRetryAfter(result.reset) };
      }

      return { allowed: true };
    } catch (error) {
      logEvent("chat_rate_guard_error", {
        level: "error",
        payload: {
          reason: "ratelimit_failure",
          message: (error as Error).message,
        },
      });

      return applyMemoryRateLimit(identifier, { forced: true });
    }
  }

  if (shouldUseMemory) {
    return applyMemoryRateLimit(identifier);
  }

  return { allowed: true };
};

export const isCircuitOpen = async (): Promise<boolean> => {
  if (redisClient) {
    try {
      const failureCount = await redisClient.get<number>(CIRCUIT_FAILURE_KEY);

      if (!failureCount) {
        return false;
      }

      return failureCount >= CIRCUIT_MAX_FAILURES;
    } catch (error) {
      logEvent("chat_rate_guard_error", {
        level: "error",
        payload: {
          reason: "redis_read_failure",
          message: (error as Error).message,
        },
      });

      return isMemoryCircuitTripped();
    }
  }

  return isMemoryCircuitTripped();
};

export const registerFailure = async (reason: string) => {
  logEvent("chat_failure", {
    level: "warn",
    payload: { reason },
  });

  if (redisClient) {
    try {
      const failures = await redisClient.incr(CIRCUIT_FAILURE_KEY);
      await redisClient.pexpire(CIRCUIT_FAILURE_KEY, CIRCUIT_COOLDOWN_MS);
      await redisClient.set(CIRCUIT_FAILURE_TS_KEY, Date.now(), {
        px: CIRCUIT_COOLDOWN_MS,
      });

      logEvent("chat_circuit_failure_incremented", {
        level: "debug",
        payload: { failures },
      });
      return;
    } catch (error) {
      logEvent("chat_rate_guard_error", {
        level: "error",
        payload: {
          reason: "redis_write_failure",
          message: (error as Error).message,
        },
      });
    }
  }

  recordMemoryFailure();
};

export const registerSuccess = async () => {
  if (redisClient) {
    try {
      await redisClient.del(CIRCUIT_FAILURE_KEY, CIRCUIT_FAILURE_TS_KEY);
    } catch (error) {
      logEvent("chat_rate_guard_error", {
        level: "error",
        payload: {
          reason: "redis_clear_failure",
          message: (error as Error).message,
        },
      });
    }
  }

  circuitMemory.failures = 0;
  circuitMemory.lastFailureAt = 0;
};

export const resetGuardsForTests = async () => {
  memoryBuckets.clear();
  circuitMemory.failures = 0;
  circuitMemory.lastFailureAt = 0;

  if (redisClient) {
    try {
      await redisClient.del(CIRCUIT_FAILURE_KEY, CIRCUIT_FAILURE_TS_KEY);
    } catch {
      // ignorado em ambiente de testes
    }
  }
};
