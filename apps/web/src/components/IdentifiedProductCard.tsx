"use client";

import React from "react";
import type { IdentifyProductOutput } from "@veylo/types";
import { Plus, Tag, Layers, AlertCircle } from "lucide-react";

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
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs mb-6">
      {/* Top Header with Category & Confidence */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 uppercase tracking-wider">
            {identified.category}
          </span>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs text-slate-500 font-medium">Inferred Product</span>
        </div>

        {/* Confidence Meter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Confidence:</span>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
            <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  confidencePercent >= 85
                    ? "bg-emerald-500"
                    : confidencePercent >= 70
                    ? "bg-amber-500"
                    : "bg-slate-500"
                }`}
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-slate-800">{confidencePercent}%</span>
          </div>
        </div>
      </div>

      {/* Product Canonical Name */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {identified.product}
          </h2>
          {identified.reasoningSummary && (
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
              {identified.reasoningSummary}
            </p>
          )}
        </div>

        {/* Add to Shopping List Action */}
        {onAddToList && (
          <button
            type="button"
            onClick={() => onAddToList(identified.product)}
            disabled={isAddingToList}
            className="self-start sm:self-center shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors border border-slate-200"
          >
            <Plus className="w-3.5 h-3.5 text-slate-600" />
            <span>{isAddingToList ? "Adding..." : "Add to Shopping List"}</span>
          </button>
        )}
      </div>

      {/* Uncertainty Notice if any */}
      {identified.uncertainty && (
        <div className="flex items-start gap-2 p-2.5 bg-amber-50/50 rounded-lg border border-amber-200/60 text-xs text-amber-800 mb-4">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
          <span>{identified.uncertainty}</span>
        </div>
      )}

      {/* Aliases & Alternatives */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Alternatives */}
        {identified.alternatives && identified.alternatives.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Layers className="w-3 h-3 text-slate-400" />
              Alternatives:
            </span>
            {identified.alternatives.map((alt) => (
              <button
                key={alt}
                type="button"
                onClick={() => onSelectAlternative?.(alt)}
                className="px-2 py-0.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded transition-colors"
                title={`Switch focus or compare: ${alt}`}
              >
                {alt}
              </button>
            ))}
          </div>
        )}

        {/* Aliases */}
        {identified.aliases && identified.aliases.length > 0 && (
          <div className="flex items-center gap-1.5 text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
            <Tag className="w-3 h-3" />
            <span className="truncate">Also known as: {identified.aliases.join(", ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

