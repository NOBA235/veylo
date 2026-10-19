"use client";

import React from "react";
import type { IdentifyProductOutput } from "@veylo/types";
import { Plus, Check, Info } from "lucide-react";

interface IdentifiedProductCardProps {
  identified: IdentifyProductOutput;
  onSelectAlternative?: (alt: string) => void;
  onAddToList?: (product: string) => void;
  isAddingToList?: boolean;
}

export function IdentifiedProductCard({
  identified,
  onSelectAlternative,
  onAddToList,
  isAddingToList = false,
}: IdentifiedProductCardProps) {
  const confidencePercent = Math.round(identified.confidence * 100);

  return (
    <div className="w-full rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-xs">
      {/* Category & Confidence */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-100 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900 capitalize">
            {identified.category}
          </span>
          <span className="text-zinc-300">•</span>
          <span className="text-zinc-500">Identified item</span>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="font-medium">{confidencePercent}% match confidence</span>
        </div>
      </div>

      {/* Canonical Product Title & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 my-2">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-950">
            {identified.product}
          </h2>
          {identified.reasoningSummary && (
            <p className="mt-1 text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-2xl">
              {identified.reasoningSummary}
            </p>
          )}
        </div>

        {onAddToList && (
          <button
            type="button"
            onClick={() => onAddToList(identified.product)}
            disabled={isAddingToList}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100 disabled:opacity-50 self-start sm:self-auto"
          >
            {isAddingToList ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Added</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 text-zinc-500" />
                <span>Add to list</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Uncertainty Notice if applicable */}
      {identified.uncertainty && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-zinc-50 border border-zinc-200/80 p-2.5 text-xs text-zinc-600">
          <Info className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
          <span>{identified.uncertainty}</span>
        </div>
      )}

      {/* Alternatives & Aliases */}
      {((identified.alternatives && identified.alternatives.length > 0) ||
        (identified.aliases && identified.aliases.length > 0)) && (
        <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          {identified.alternatives && identified.alternatives.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-zinc-400 mr-0.5">Alternatives:</span>
              {identified.alternatives.map((alt) => (
                <button
                  key={alt}
                  type="button"
                  onClick={() => onSelectAlternative?.(alt)}
                  className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                  title={`Switch to ${alt}`}
                >
                  {alt}
                </button>
              ))}
            </div>
          )}

          {identified.aliases && identified.aliases.length > 0 && (
            <div className="text-zinc-400 text-[11px] truncate">
              Also called: {identified.aliases.join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
