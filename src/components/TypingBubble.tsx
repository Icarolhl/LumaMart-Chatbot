"use client";

import React from "react";
import { motion } from "framer-motion";

export default function TypingBubble() {
  const dots = [0, 0.2, 0.4];

  return (
    <div className="flex justify-start">
      <motion.div
        className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--typing-bg)] px-4 py-2 text-sm text-[var(--typing-text)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <span>Digitando</span>
        {dots.map((delay, index) => (
          <motion.span
            key={index}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ repeat: Infinity, duration: 1, delay }}
          >
            .
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}
