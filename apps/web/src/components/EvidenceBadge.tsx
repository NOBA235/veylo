"use client";

import React from "react";
import type { InventoryStatus } from "@veylo/types";
import { CheckCircle2, AlertCircle, Globe, HelpCircle } from "lucide-react";

interface EvidenceBadgeProps {
  status: InventoryStatus;
  confidence?: number;
  className?: string;
}

export function EvidenceBadge({ status, confidence, className = "" }: EvidenceBadgeProps) {
  switch (status) {
    case "CONFIRMED":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}
          title="Explicit evidence exists for current shelf stock"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>CONFIRMED</span>
          {confidence !== undefined && (
            <span className="text-emerald-600 font-mono text-[10px]">({Math.round(confidence * 100)}%)</span>
          )}
        </span>
      );

    case "LIKELY":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 ${className}`}
          title="Strong store category match & online listing; shelf stock unconfirmed"
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          <span>LIKELY</span>
          {confidence !== undefined && (
            <span className="text-amber-600 font-mono text-[10px]">({Math.round(confidence * 100)}%)</span>
          )}
        </span>
      );

    case "WEB_FOUND":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 ${className}`}
          title="Web source mentions the product or business; not verified in store"
        >
          <Globe className="w-3.5 h-3.5 text-blue-600" />
          <span>WEB FOUND</span>
          {confidence !== undefined && (
            <span className="text-blue-600 font-mono text-[10px]">({Math.round(confidence * 100)}%)</span>
          )}
        </span>
      );

    case "UNKNOWN":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 ${className}`}
          title="Relevant store category, but no current inventory evidence exists"
        >
          <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
          <span>UNKNOWN</span>
          {confidence !== undefined && (
            <span className="text-slate-500 font-mono text-[10px]">({Math.round(confidence * 100)}%)</span>
          )}
        </span>
      );
  }
}

