"use client";

import React from "react";
import type { GetPlaceDetailsOutput, CheckLocalInventoryOutput } from "@veylo/types";
import { EvidenceBadge } from "./EvidenceBadge";
import { X, Store, MapPin, Phone, Globe, Clock, Navigation } from "lucide-react";

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: GetPlaceDetailsOutput | null;
  check?: CheckLocalInventoryOutput;
  onGetDirections?: () => void;
}

export function StoreModal({
  isOpen,
  onClose,
  details,
  check,
  onGetDirections,
}: StoreModalProps) {
  if (!isOpen || !details) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-zinc-950/40 p-0 backdrop-blur-xs sm:items-center sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-modal-title"
    >
      <div className="my-auto max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl sm:rounded-xl border border-zinc-200 bg-white shadow-2xl sm:max-w-md">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 p-4 sm:p-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
              <Store className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3
                id="store-modal-title"
                className="font-semibold text-zinc-950 text-base leading-snug truncate"
              >
                {details.name}
              </h3>
              <p className="text-xs text-zinc-500 capitalize">{details.category}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close store details"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-3.5 text-xs">
          {/* Inventory Trust Status */}
          {check && (
            <div className="rounded-lg bg-zinc-50 border border-zinc-200/80 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-zinc-700">Inventory Status</span>
                <EvidenceBadge status={check.status} confidence={check.confidence} />
              </div>
              <p className="text-zinc-600 leading-relaxed">
                {check.evidence?.[0]?.evidenceSummary ??
                  "Evaluated based on store category."}
              </p>
              {check.nextAction && (
                <p className="mt-1.5 font-medium text-zinc-900 border-t border-zinc-200/60 pt-1 text-[11px]">
                  Next action: {check.nextAction}
                </p>
              )}
            </div>
          )}

          {/* Contact & Hours Info */}
          <div className="space-y-2 rounded-lg border border-zinc-100 bg-zinc-50/40 p-3">
            {details.address && (
              <div className="flex items-start gap-2 text-zinc-700">
                <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{details.address}</span>
              </div>
            )}

            {details.phone ? (
              <div className="flex items-center gap-2 text-zinc-700">
                <Phone className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <a
                  href={`tel:${details.phone}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {details.phone}
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-zinc-400">
                <Phone className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
                <span>No phone number listed in public registry</span>
              </div>
            )}

            {details.website && (
              <div className="flex items-center gap-2 text-zinc-700">
                <Globe className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <a
                  href={
                    details.website.startsWith("http")
                      ? details.website
                      : `https://${details.website}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-700 hover:underline truncate"
                >
                  {details.website}
                </a>
              </div>
            )}

            {details.openingHours ? (
              <div className="flex items-start gap-2 text-zinc-700">
                <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
                <span>{details.openingHours}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-zinc-400">
                <Clock className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
                <span>Operating hours not listed</span>
              </div>
            )}
          </div>

          {/* Evidence Trail */}
          {details.evidence && details.evidence.length > 0 && (
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
                Evidence verification records ({details.evidence.length})
              </span>
              <div className="space-y-1.5">
                {details.evidence.map((ev, i) => (
                  <div
                    key={i}
                    className="rounded border border-zinc-200 bg-white p-2 text-[11px]"
                  >
                    <div className="flex items-center justify-between text-zinc-400 mb-0.5">
                      <span>Source: {ev.source}</span>
                      <span>{Math.round(ev.confidence * 100)}%</span>
                    </div>
                    <p className="text-zinc-700">{ev.evidenceSummary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50 px-4 py-3 sm:px-5">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Close
          </button>

          {onGetDirections && (
            <button
              onClick={() => {
                onClose();
                onGetDirections();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>Get Directions</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
