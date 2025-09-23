import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/chat/route";
import { resetGuardsForTests } from "@/lib/chatGuards";

const originalFetch = globalThis.fetch;

const buildRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  await resetGuardsForTests();
  vi.restoreAllMocks();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe("POST /api/chat", () => {
  it("retorna 200 e resposta da OpenRouter para payload válido", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "Olá! Como posso ajudar?",
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        )
      )
    );

    // @ts-expect-error override para teste
    globalThis.fetch = fetchMock;

    const req = buildRequest(
      {
        messages: [
          { role: "user", content: "Oi" },
          { role: "assistant", content: "Olá!" },
        ],
      },
      {
        "x-forwarded-for": "10.0.0.1",
      }
    );

    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload).toEqual({ reply: "Olá! Como posso ajudar?" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejeita payload inválido com 400 e não chama OpenRouter", async () => {
    const fetchSpy = vi.fn();
    // @ts-expect-error override para teste
    globalThis.fetch = fetchSpy;

    const longText = "a".repeat(2100);

    const req = buildRequest({
      messages: [{ role: "user", content: longText }],
    });

    const res = await POST(req as any);
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("aplica rate limiting e responde 429 quando excede o limite", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Tudo certo!" } }],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );

    // @ts-expect-error override para teste
    globalThis.fetch = fetchMock;

    const headers = { "x-forwarded-for": "22.22.22.22" };

    for (let i = 0; i < 10; i += 1) {
      const res = await POST(
        buildRequest(
          { messages: [{ role: "user", content: `ping-${i}` }] },
          headers
        ) as any
      );
      expect(res.status).toBe(200);
    }

    const limitedResponse = await POST(
      buildRequest(
        { messages: [{ role: "user", content: "ping-ultimate" }] },
        headers
      ) as any
    );

    expect(limitedResponse.status).toBe(429);
  });

  it("abre circuito após falhas consecutivas e responde 503", async () => {
    const failingFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response("erro", { status: 502 }))
    );

    // @ts-expect-error override para teste
    globalThis.fetch = failingFetch;

    const headers = { "x-forwarded-for": "33.33.33.33" };

    for (let i = 0; i < 5; i += 1) {
      const res = await POST(
        buildRequest(
          { messages: [{ role: "user", content: `fail-${i}` }] },
          headers
        ) as any
      );
      expect(res.status).toBe(502);
    }

    failingFetch.mockClear();

    const circuitResponse = await POST(
      buildRequest(
        { messages: [{ role: "user", content: "should-block" }] },
        headers
      ) as any
    );

    expect(circuitResponse.status).toBe(503);
    expect(failingFetch).not.toHaveBeenCalled();
  });
});
