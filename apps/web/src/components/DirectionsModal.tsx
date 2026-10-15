"use client";

import React from "react";
import type { GetDirectionsOutput } from "@veylo/types";
import { X, Navigation, ExternalLink, MapPin } from "lucide-react";

interface DirectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  directions: GetDirectionsOutput | null;
}

export function DirectionsModal({
  isOpen,
  onClose,
  directions,
}: DirectionsModalProps) {
  if (!isOpen || !directions) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end overflow-y-auto bg-slate-900/40 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div className="my-auto max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-150 sm:max-w-md sm:rounded-2xl">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Get Directions</h3>
              <p className="text-xs text-slate-500 capitalize">{directions.mode} Mode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close directions"
            className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/50 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-700 block mb-0.5">Destination:</span>
              <span className="text-slate-900">{directions.destination}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Navigation route provided via {directions.source}. Ready to launch navigation?
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={onClose}
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Cancel
          </button>
          <a
            href={directions.url}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            <span>Open in Maps</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

