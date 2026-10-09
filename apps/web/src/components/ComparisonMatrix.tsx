"use client";

import React from "react";
import type { CompareProductsOutput } from "@veylo/types";
import { EvidenceBadge } from "./EvidenceBadge";
import { Award, Check, X, MapPin } from "lucide-react";

interface ComparisonMatrixProps {
  comparison: CompareProductsOutput;
}

export function ComparisonMatrix({ comparison }: ComparisonMatrixProps) {
  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs mb-6">
      {/* Agent Recommendation Banner */}
      <div className="flex items-start gap-3 p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl mb-5">
        <Award className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-800">
              Recommendation
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900 mt-0.5">
            {comparison.recommendation}
          </p>
          {comparison.reasoningSummary && (
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {comparison.reasoningSummary}
            </p>
          )}
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {comparison.comparison.map((item, idx) => (
          <div
            key={item.product || idx}
            className="flex flex-col justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="font-semibold text-slate-900 text-sm">{item.product}</h4>
                <EvidenceBadge status={item.availability} />
              </div>

              {item.distanceMeters !== undefined && (
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {item.distanceMeters < 1000
                      ? `${item.distanceMeters}m away`
                      : `${(item.distanceMeters / 1000).toFixed(1)}km away`}
                  </span>
                </div>
              )}

              {/* Pros */}
              {item.pros && item.pros.length > 0 && (
                <div className="mb-2.5">
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide">
                    Pros:
                  </span>
                  <ul className="mt-1 space-y-1">
                    {item.pros.map((pro, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cons */}
              {item.cons && item.cons.length > 0 && (
                <div>
                  <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wide">
                    Cons:
                  </span>
                  <ul className="mt-1 space-y-1">
                    {item.cons.map((con, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                        <X className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
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

