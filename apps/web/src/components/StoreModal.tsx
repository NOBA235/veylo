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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg leading-snug">
                {details.name}
              </h3>
              <p className="text-xs text-slate-500 capitalize">{details.category}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Inventory Trust Status */}
          {check && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-700">Inventory Status:</span>
                <EvidenceBadge status={check.status} confidence={check.confidence} />
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {check.evidence?.[0]?.evidenceSummary ?? "Status evaluated from store category."}
              </p>
              {check.nextAction && (
                <p className="text-xs font-semibold text-slate-800 mt-1">
                  Next Step: {check.nextAction}
                </p>
              )}
            </div>
          )}

          {/* Contact & Location Info */}
          <div className="space-y-2.5 text-xs">
            {details.address && (
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{details.address}</span>
              </div>
            )}

            {details.phone ? (
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <a
                  href={`tel:${details.phone}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {details.phone}
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 italic">
                <Phone className="w-4 h-4 text-slate-300 shrink-0" />
                <span>No phone number listed in OpenStreetMap data</span>
              </div>
            )}

            {details.website ? (
              <div className="flex items-center gap-2 text-slate-700">
                <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                <a
                  href={details.website.startsWith("http") ? details.website : `https://${details.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline truncate"
                >
                  {details.website}
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 italic">
                <Globe className="w-4 h-4 text-slate-300 shrink-0" />
                <span>No website listed</span>
              </div>
            )}

            {details.openingHours ? (
              <div className="flex items-start gap-2 text-slate-700">
                <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{details.openingHours}</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-slate-400 italic">
                <Clock className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                <span>Opening hours not reported. Never fabricated.</span>
              </div>
            )}
          </div>

          {/* Evidence Details */}
          {details.evidence && details.evidence.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Evidence Records ({details.evidence.length})
              </span>
              <div className="space-y-1.5">
                {details.evidence.map((ev, i) => (
                  <div key={i} className="text-[11px] p-2 bg-slate-50 rounded border border-slate-200">
                    <div className="flex items-center justify-between text-slate-500 mb-0.5">
                      <span>Source: {ev.source} ({ev.sourceType})</span>
                      <span>{Math.round(ev.confidence * 100)}% conf</span>
                    </div>
                    <p className="text-slate-700">{ev.evidenceSummary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>

          {onGetDirections && (
            <button
              onClick={() => {
                onClose();
                onGetDirections();
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Get Directions</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
