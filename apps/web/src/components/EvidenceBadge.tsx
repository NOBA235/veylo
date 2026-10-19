"use client";

import React from "react";
import type { InventoryStatus } from "@veylo/types";

interface EvidenceBadgeProps {
  status: InventoryStatus;
  confidence?: number;
  className?: string;
}

export function EvidenceBadge({
  status,
  confidence,
  className = "",
}: EvidenceBadgeProps) {
  const confText =
    confidence !== undefined ? ` · ${Math.round(confidence * 100)}%` : "";

  switch (status) {
    case "CONFIRMED":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ${className}`}
          title="Verified shelf stock confirmed by store inventory record"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          <span>In stock</span>
          {confText && (
            <span className="text-[10px] text-emerald-700/80 font-mono">
              {confText}
            </span>
          )}
        </span>
      );

    case "LIKELY":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ${className}`}
          title="High probability based on store catalog; shelf inventory unverified"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          <span>Likely in store</span>
          {confText && (
            <span className="text-[10px] text-amber-700/80 font-mono">
              {confText}
            </span>
          )}
        </span>
      );

    case "WEB_FOUND":
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800 ${className}`}
          title="Listed on store website; local on-shelf stock unconfirmed"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
          <span>Online listing</span>
          {confText && (
            <span className="text-[10px] text-sky-700/80 font-mono">
              {confText}
            </span>
          )}
        </span>
      );

    case "UNKNOWN":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 ${className}`}
          title="Relevant store category, but physical on-shelf stock is unverified"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          <span>Stock unverified</span>
          {confText && (
            <span className="text-[10px] text-zinc-500 font-mono">{confText}</span>
          )}
        </span>
      );
  }
}
