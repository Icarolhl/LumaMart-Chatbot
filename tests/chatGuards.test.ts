import { beforeEach, describe, expect, it } from "vitest";

import {
  ensureRateLimit,
  isCircuitOpen,
  registerFailure,
  registerSuccess,
  resetGuardsForTests,
} from "@/lib/chatGuards";

describe("chatGuards", () => {
  beforeEach(async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    await resetGuardsForTests();
  });

  it("permite chamadas dentro do limite configurado", async () => {
    const result = await ensureRateLimit("tester");
    expect(result.allowed).toBe(true);
  });

  it("bloqueia quando excede o limite em memória", async () => {
    for (let i = 0; i < 10; i += 1) {
      const { allowed } = await ensureRateLimit("burst");
      expect(allowed).toBe(true);
    }

    const finalResult = await ensureRateLimit("burst");
    expect(finalResult.allowed).toBe(false);
    expect(finalResult.retryAfterMs).toBeGreaterThan(0);
  });

  it("abre circuito após falhas consecutivas", async () => {
    for (let i = 0; i < 5; i += 1) {
      await registerFailure(`fail-${i}`);
    }

    expect(await isCircuitOpen()).toBe(true);

    await registerSuccess();
    expect(await isCircuitOpen()).toBe(false);
  });
});
