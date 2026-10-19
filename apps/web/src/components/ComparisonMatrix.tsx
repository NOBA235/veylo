"use client";

import React from "react";
import type { CompareProductsOutput } from "@veylo/types";
import { EvidenceBadge } from "./EvidenceBadge";
import { Check, Minus, MapPin, Sparkles } from "lucide-react";

interface ComparisonMatrixProps {
  comparison: CompareProductsOutput;
}

export function ComparisonMatrix({ comparison }: ComparisonMatrixProps) {
  return (
    <div className="w-full rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-xs">
      {/* Recommendation Summary */}
      <div className="mb-4 rounded-lg bg-zinc-50 border border-zinc-200/80 p-3.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
          <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
          <span>Recommendation</span>
        </div>
        <p className="text-sm font-semibold text-zinc-950">
          {comparison.recommendation}
        </p>
        {comparison.reasoningSummary && (
          <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
            {comparison.reasoningSummary}
          </p>
        )}
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {comparison.comparison.map((item, idx) => (
          <div
            key={item.product || idx}
            className="flex flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50/40 p-3.5 text-xs"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-semibold text-zinc-900 text-sm">
                  {item.product}
                </h4>
                <EvidenceBadge status={item.availability} className="shrink-0" />
              </div>

              {item.distanceMeters !== undefined && (
                <div className="flex items-center gap-1 text-xs text-zinc-500 mb-2.5">
                  <MapPin className="h-3 w-3 text-zinc-400" />
                  <span>
                    {item.distanceMeters < 1000
                      ? `${item.distanceMeters}m away`
                      : `${(item.distanceMeters / 1000).toFixed(1)} km away`}
                  </span>
                </div>
              )}

              {/* Pros */}
              {item.pros && item.pros.length > 0 && (
                <div className="mb-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Advantages
                  </span>
                  <ul className="mt-1 space-y-1">
                    {item.pros.map((pro, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-zinc-700">
                        <Check className="h-3 w-3 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cons */}
              {item.cons && item.cons.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Drawbacks
                  </span>
                  <ul className="mt-1 space-y-1">
                    {item.cons.map((con, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-zinc-600">
                        <Minus className="h-3 w-3 text-zinc-400 shrink-0 mt-0.5" />
                        <span>{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
