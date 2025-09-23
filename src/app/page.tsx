"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center text-[var(--foreground)]"
    >
      <div
        className="mb-8 rounded-full border border-[var(--border)] bg-[var(--surface)] p-4"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <Image
          src="/avatar-lumamart.png"
          alt="LumaMart Avatar"
          width={80}
          height={80}
          className="rounded-full transition-transform duration-300 hover:scale-105"
          priority
        />
      </div>

      <h1 className="mb-4 text-4xl font-bold sm:text-5xl">LumaMart Chatbot</h1>

      <p className="mb-6 max-w-md text-[var(--muted)]">
        Seu concierge digital para navegar pelo e-commerce da LumaMart: descubra produtos,
        ofertas relâmpago e suporte em segundos, direto pelo chat.
      </p>

      <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row">
        <Link
          href="/chat"
          className="rounded-xl border border-[var(--primary)] bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-md transition-colors hover:bg-[var(--primary-hover)]"
        >
          Falar com o Chatbot
        </Link>

        <Link
          href="https://github.com/Icarolhl/LumaMart-Chatbot"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] shadow-md transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          Ver Repositorio no GitHub
        </Link>
      </div>

      <p className="text-xs italic text-[var(--muted)]">
        Feito com carinho por Icaro.
      </p>
    </motion.main>
  );
}


