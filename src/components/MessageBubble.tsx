"use client";

import React from "react";
import Image from "next/image";

type Props = {
  from: "user" | "bot";
  text: string;
};

export default function MessageBubble({ from, text }: Props) {
  const isUser = from === "user";
  const senderName = isUser ? "Voce" : "LumaMart BOT";

  const bubbleStyle = isUser
    ? {
        background: "var(--bubble-user-bg)",
        color: "var(--bubble-user-text)",
        boxShadow: "0 18px 28px -25px rgba(37, 99, 235, 0.65)",
      }
    : {
        background: "var(--bubble-bot-bg)",
        color: "var(--bubble-bot-text)",
      };

  return (
    <div
      className={`mb-2 flex items-center gap-3 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && (
        <Image
          src="/avatar-lumamart.png"
          alt="LumaMart Bot Avatar"
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-full"
        />
      )}
      <div className="flex max-w-[70%] flex-col space-y-1">
        <span
          className={`text-xs font-semibold ${
            isUser
              ? "self-end text-right text-[var(--chat-user-name)]"
              : "text-[var(--chat-bot-name)]"
          }`}
        >
          {senderName}
        </span>
        <div
          className={`rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm transition-colors duration-200 ${
            isUser ? "self-end" : "border border-[var(--border)]"
          }`}
          style={bubbleStyle}
        >
          {text}
        </div>
      </div>
    </div>
  );
}
