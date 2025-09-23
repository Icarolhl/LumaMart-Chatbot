import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChatBox from "@/components/ChatBox";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

describe("ChatBox", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    class MockAudio {
      public volume = 0;

      play = vi.fn().mockResolvedValue(undefined);
    }

    // @ts-expect-error Audio override para cenário de teste
    global.Audio = MockAudio;

    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
    // @ts-expect-error cleanup
    delete window.HTMLElement.prototype.scrollIntoView;
  });

  it("exibe mensagem inicial do bot após atraso configurado", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => ({ reply: "Resposta teste" }),
      } as Response);

    render(<ChatBox />);

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getAllByText(/LumaMart BOT/i).length).toBeGreaterThan(0);
    fetchMock.mockRestore();
  });

  it("limpa timers ativos ao desmontar", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "Resposta teste" }),
    } as Response);

    const { unmount } = render(<ChatBox />);
    const pendingBefore = vi.getTimerCount();

    expect(pendingBefore).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it(
    "utiliza fallback local quando a chamada à API falha",
    async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("network"));
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      render(<ChatBox />);

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      const input = screen.getByPlaceholderText(
        /Fale com o bot/i
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "ajuda" } });

      const form = input.closest("form");
      expect(form).not.toBeNull();

      await act(async () => {
        fireEvent.submit(form!);
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Erro ao tentar enviar mensagem para a API de IA:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    },
    10000
  );
});
