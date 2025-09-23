"use client";

import React from "react";
import Link from "next/link";

type Props = {
  url: string;
};

export default function ExternalLinkBubble({ url }: Props) {
  return (
    <div className="ml-12 mt-5 max-w-[80%]">
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--link)] transition-colors duration-200 hover:text-[var(--link-hover)]"
      >
        <span className="text-base">-&gt;</span>
        <span>Abrir no site da LumaMart</span>
      </Link>
    </div>
  );
}
