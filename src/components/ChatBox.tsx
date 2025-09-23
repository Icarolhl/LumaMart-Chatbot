"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import TypingBubble from "./TypingBubble";
import ExternalLinkBubble from "./ExternalLinkBubble";

import rawResponsesData from "@/data/responses.json";

const helpCategories = [
  "departamentos",
  "status do pedido",
  "trocas",
  "pagamento",
  "promoções",
];

const departmentOptions = ["moda", "tecnologia", "casa"];

const responsesData = rawResponsesData as {
  responses: { [key: string]: string[] };
};

type Message = {
  from: "bot" | "user";
  text: string;
  type?: "text" | "link";
  url?: string;
};

type SpecialMode = "departamentos" | null;

export default function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showHelpOptions, setShowHelpOptions] = useState(false);
  const [specialMode, setSpecialMode] = useState<SpecialMode>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const introTimeoutRef = useRef<number | null>(null);
  const replyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setIsTyping(true);
    const introDelay = Math.random() * (2700 - 1200) + 1200;
    introTimeoutRef.current = window.setTimeout(() => {
      setMessages([
        { from: "bot", type: "text", text: getResponse("intro") },
      ]);
      setIsTyping(false);
      playNotificationSound();
      introTimeoutRef.current = null;
    }, introDelay);

    return () => {
      if (introTimeoutRef.current) {
        window.clearTimeout(introTimeoutRef.current);
      }
      if (replyTimeoutRef.current) {
        window.clearTimeout(replyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const playNotificationSound = () => {
    if (typeof window === "undefined" || typeof window.Audio !== "function") {
      return;
    }

    const audio = new window.Audio("/sounds/notification.mp3");
    audio.volume = 0.5;
    void audio.play().catch(() => undefined);
  };

  const toTitleCase = (text: string) =>
    text
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  const getSupportLink = (category: string) => {
    const links: { [key: string]: string } = {
      moda: "https://www.lumamart.shop/departamentos/moda",
      tecnologia: "https://www.lumamart.shop/departamentos/tecnologia",
      casa: "https://www.lumamart.shop/departamentos/casa-e-decor",
      status: "https://www.lumamart.shop/minha-conta/pedidos",
      trocas: "https://www.lumamart.shop/atendimento/trocas",
      pagamento: "https://www.lumamart.shop/ajuda/pagamentos",
      promocoes: "https://www.lumamart.shop/ofertas",
    };
    return links[category] || null;
  };

  const getResponse = (key: string) => {
    const options = responsesData.responses[key];
    if (!options) return "Desculpe, não encontrei essa informação agora.";
    return options[Math.floor(Math.random() * options.length)];
  };

  const simulateBotResponse = (input: string): Message[] => {
    const lower = input.toLowerCase();

    if (departmentOptions.includes(lower)) {
      const link = getSupportLink(lower);
      return [
        { from: "bot", type: "text", text: getResponse(lower) },
        ...(link ? [{ from: "bot", type: "link", text: "", url: link }] : []),
      ];
    }

    if (lower === "promoções" || lower === "promocoes") {
      const link = getSupportLink("promocoes");
      return [
        { from: "bot", type: "text", text: getResponse("promoções") },
        ...(link ? [{ from: "bot", type: "link", text: "", url: link }] : []),
      ];
    }

    if (lower === "trocas" || lower.includes("troca")) {
      const link = getSupportLink("trocas");
      return [
        { from: "bot", type: "text", text: getResponse("trocas") },
        ...(link ? [{ from: "bot", type: "link", text: "", url: link }] : []),
      ];
    }

    if (lower === "pagamento" || lower === "pagamentos") {
      const link = getSupportLink("pagamento");
      return [
        { from: "bot", type: "text", text: getResponse("pagamento") },
        ...(link ? [{ from: "bot", type: "link", text: "", url: link }] : []),
      ];
    }

    if (lower === "status do pedido" || lower.includes("status")) {
      const link = getSupportLink("status");
      return [
        { from: "bot", type: "text", text: getResponse("status do pedido") },
        ...(link ? [{ from: "bot", type: "link", text: "", url: link }] : []),
      ];
    }

    if (lower.includes("depart")) {
      setSpecialMode("departamentos");
      return [
        { from: "bot", type: "text", text: getResponse("departamentos pergunta") },
      ];
    }

    if (lower.includes("promo")) {
      const link = getSupportLink("promocoes");
      return [
        { from: "bot", type: "text", text: getResponse("promoções") },
        ...(link ? [{ from: "bot", type: "link", text: "", url: link }] : []),
      ];
    }

    if (lower.includes("ajuda")) {
      setShowHelpOptions(true);
      return [{ from: "bot", type: "text", text: getResponse("ajuda") }];
    }

    return [{ from: "bot", type: "text", text: getResponse("fallback") }];
  };

  const queueBotMessages = (messagesToAdd: Message[]) => {
    if (replyTimeoutRef.current) {
      window.clearTimeout(replyTimeoutRef.current);
    }

    const delay = Math.random() * (2700 - 1200) + 1200;

    replyTimeoutRef.current = window.setTimeout(() => {
      setMessages((prev) => [...prev, ...messagesToAdd]);
      setIsTyping(false);
      playNotificationSound();
      replyTimeoutRef.current = null;
    }, delay);
  };

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    setMessages((prev) => [
      ...prev,
      { from: "user", type: "text", text: text.trim() },
    ]);
    setIsTyping(true);
    setShowHelpOptions(false);
    setSpecialMode(null);

    try {
      const recent = messages.slice(-5).map((m) => ({
        role: m.from === "user" ? "user" : "assistant",
        content: m.text,
      }));

      const payload = [...recent, { role: "user", content: text.trim() }];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });

      if (!res.ok) throw new Error();

      const data = await res.json();
      const botMsg = data.reply;

      queueBotMessages([
        { from: "bot", type: "text", text: botMsg },
      ]);
    } catch (error) {
      console.error("Erro ao tentar enviar mensagem para a API de IA:", error);

      const fallback = simulateBotResponse(text);

      queueBotMessages(fallback);
    }
  };

  const handleOptionSelect = (key: string) => {
    if (specialMode === "departamentos") {
      handleSend(key);
      setSpecialMode(null);
    } else {
      handleSend(key);
    }
  };

  const renderSpecialOptions = () => {
    if (specialMode === "departamentos" && !isTyping) {
      return (
        <div className="mt-8 mb-8 flex flex-wrap justify-center gap-4 px-2">
          {departmentOptions.map((key) => (
            <button
              key={key}
              onClick={() => handleOptionSelect(key)}
              className="rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-5 py-2 text-sm font-medium text-[var(--chip-text)] shadow-sm transition-all duration-300 hover:border-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
            >
              {toTitleCase(key)}
            </button>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="relative flex h-[600px] w-full max-w-xl flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 pb-4 pt-6 text-[var(--foreground)] shadow-lg transition-all duration-300 sm:max-w-md md:max-w-lg lg:max-w-xl"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <Link
        href="/"
        className="absolute right-4 top-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
        aria-label="Voltar para a pagina inicial"
      >
        X
      </Link>

      <div className="mb-8 flex-1 space-y-2 overflow-y-auto scroll-smooth pr-2">
        {messages.map((msg, idx) =>
          msg.type === "link" ? (
            <ExternalLinkBubble key={idx} url={msg.url!} />
          ) : (
            <MessageBubble key={idx} from={msg.from} text={msg.text} />
          )
        )}
        {isTyping && <TypingBubble />}
        {renderSpecialOptions()}
        {showHelpOptions && !isTyping && (
          <div className="mt-8 mb-8 flex flex-wrap justify-center gap-4 px-2">
            {helpCategories.map((key) => (
              <button
                key={key}
                onClick={() => handleOptionSelect(key)}
                className="rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-5 py-2 text-sm font-medium text-[var(--chip-text)] shadow-sm transition-all duration-300 hover:border-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
              >
                {toTitleCase(key)}
              </button>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={handleSend} />
    </div>
  );
}

