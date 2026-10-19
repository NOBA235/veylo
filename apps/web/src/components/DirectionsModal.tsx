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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-zinc-950/40 p-0 backdrop-blur-xs sm:items-center sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="directions-modal-title"
    >
      <div className="my-auto max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl sm:rounded-xl border border-zinc-200 bg-white shadow-2xl sm:max-w-md">
        <div className="flex items-center justify-between border-b border-zinc-100 p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
              <Navigation className="h-4 w-4" />
            </div>
            <div>
              <h3
                id="directions-modal-title"
                className="font-semibold text-zinc-950 text-base"
              >
                Directions
              </h3>
              <p className="text-xs text-zinc-500 capitalize">
                {directions.mode} navigation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close directions"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3 text-xs">
          <div className="flex items-start gap-2.5 rounded-lg bg-zinc-50 border border-zinc-200/80 p-3">
            <MapPin className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-zinc-700 block mb-0.5">
                Destination:
              </span>
              <span className="text-zinc-950 font-medium leading-relaxed">
                {directions.destination}
              </span>
            </div>
          </div>

          <p className="text-zinc-500 text-xs">
            Open route in your default mapping app ({directions.source}).
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50 px-4 py-3 sm:px-5">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Cancel
          </button>
          <a
            href={directions.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
          >
            <span>Open in Maps</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
