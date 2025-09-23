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

export const ensureRateLimit = async (
  identifier: string
): Promise<RateLimitResult> => {
  if (ratelimit) {
    const result = await ratelimit.limit(`chat:${identifier}`);

    if (!result.success) {
      logEvent("rate_limit_blocked", {
        level: "warn",
        payload: { identifier, remaining: result.remaining, reset: result.reset },
      });
      return { allowed: false, retryAfterMs: getRetryAfter(result.reset) };
    }

    return { allowed: true };
  }

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

export const isCircuitOpen = async (): Promise<boolean> => {
  if (redisClient) {
    const failureCount = await redisClient.get<number>(CIRCUIT_FAILURE_KEY);

    if (!failureCount) {
      return false;
    }

    return failureCount >= CIRCUIT_MAX_FAILURES;
  }

  if (circuitMemory.failures < CIRCUIT_MAX_FAILURES) {
    return false;
  }

  const now = Date.now();

  if (now - circuitMemory.lastFailureAt <= CIRCUIT_COOLDOWN_MS) {
    return true;
  }

  circuitMemory.failures = 0;
  return false;
};

export const registerFailure = async (reason: string) => {
  logEvent("chat_failure", {
    level: "warn",
    payload: { reason },
  });

  if (redisClient) {
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
  }

  circuitMemory.failures += 1;
  circuitMemory.lastFailureAt = Date.now();
};

export const registerSuccess = async () => {
  if (redisClient) {
    await redisClient.del(CIRCUIT_FAILURE_KEY, CIRCUIT_FAILURE_TS_KEY);
  }

  circuitMemory.failures = 0;
};

export const resetGuardsForTests = async () => {
  memoryBuckets.clear();
  circuitMemory.failures = 0;
  circuitMemory.lastFailureAt = 0;

  if (redisClient) {
    await redisClient.del(CIRCUIT_FAILURE_KEY, CIRCUIT_FAILURE_TS_KEY);
  }
};
