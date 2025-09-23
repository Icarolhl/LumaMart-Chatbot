"use client";

import React from "react";

import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        isLight ? "Ativar modo escuro" : "Ativar modo claro"
      }
      className="group fixed right-6 top-6 z-50 flex items-center gap-3 rounded-full border
                 border-[var(--toggle-border)] bg-[var(--toggle-bg)] px-4 py-2 text-xs
                 font-semibold uppercase tracking-wide text-[var(--muted)] transition
                 duration-200 hover:border-[var(--primary)] hover:bg-[var(--primary)]
                 hover:text-[var(--primary-foreground)] focus-visible:outline
                 focus-visible:outline-2 focus-visible:outline-offset-2
                 focus-visible:outline-[var(--primary)]"
    >
      <span
        className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full
                   bg-[var(--surface-muted)] text-[var(--primary)] shadow-sm transition
                   duration-200 group-hover:bg-[var(--primary)] group-hover:text-[var(--primary-foreground)]"
      >
        <svg
          className={`absolute h-5 w-5 transform transition-all duration-300 ease-out ${
            isLight ? "scale-100 opacity-100 rotate-0" : "scale-0 opacity-0 rotate-45"
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.93 4.93l1.41 1.41" />
          <path d="M17.66 17.66l1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M6.34 17.66l-1.41 1.41" />
          <path d="M19.07 4.93l-1.41 1.41" />
        </svg>
        <svg
          className={`absolute h-5 w-5 transform transition-all duration-300 ease-out ${
            isLight ? "scale-0 opacity-0 -rotate-45" : "scale-100 opacity-100 rotate-0"
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79z" />
        </svg>
      </span>
      <span>{isLight ? "Modo claro" : "Modo escuro"}</span>
    </button>
  );
}
