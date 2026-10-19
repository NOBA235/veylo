"use client";

import React from "react";
import type { DiscoverLocalPlacesOutput, CheckLocalInventoryOutput } from "@veylo/types";
import { EvidenceBadge } from "./EvidenceBadge";
import { MapPin, Navigation, Phone, Info, Store } from "lucide-react";

interface LocalPlacesGridProps {
  places: DiscoverLocalPlacesOutput["places"];
  checks?: Record<string, CheckLocalInventoryOutput>;
  onViewDetails: (placeId: string) => void;
  onGetDirections: (placeId: string) => void;
  onContactStore: (storeId: string) => void;
  bestPlaceId?: string;
}

export function LocalPlacesGrid({
  places,
  checks = {},
  onViewDetails,
  onGetDirections,
  onContactStore,
  bestPlaceId,
}: LocalPlacesGridProps) {
  if (!places || places.length === 0) {
    return (
      <div className="w-full rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-500">
        <Store className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-zinc-700">No matching local stores found nearby</p>
        <p className="text-xs text-zinc-500 mt-1">Try widening your search location or checking online delivery.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">Nearby store options</h3>
          <span className="text-xs text-zinc-500 font-normal">({places.length})</span>
        </div>
        <span className="text-[11px] text-zinc-400">OpenStreetMap verified</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {places.map((place) => {
          const check = checks[place.id];
          const status = check?.status ?? place.inventoryStatus ?? "UNKNOWN";
          const confidence = check?.confidence;
          const isBest = place.id === bestPlaceId;

          const distanceLabel =
            place.distanceMeters !== undefined
              ? place.distanceMeters < 1000
                ? `${place.distanceMeters}m away`
                : `${(place.distanceMeters / 1000).toFixed(1)} km away`
              : "Distance unknown";

          const evidenceNote =
            check?.evidence?.[0]?.evidenceSummary ??
            place.evidenceSummary ??
            "Store category matches product type. Shelf inventory unconfirmed.";

          return (
            <div
              key={place.id}
              className={`flex flex-col justify-between rounded-xl border bg-white p-4 shadow-2xs transition-all ${
                isBest
                  ? "border-zinc-300 ring-1 ring-zinc-300"
                  : "border-zinc-200 hover:border-zinc-300"
              }`}
            >
              <div>
                {/* Header: Name & Badge */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    {isBest && (
                      <span className="inline-block mb-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-700 border border-zinc-200">
                        Top match
                      </span>
                    )}
                    <h4 className="font-semibold text-zinc-950 text-sm leading-snug truncate">
                      {place.name || `Local ${place.category}`}
                    </h4>
                  </div>
                  <EvidenceBadge status={status} confidence={confidence} className="shrink-0" />
                </div>

                {/* Metadata: Category & Distance */}
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2.5">
                  <span className="capitalize">{place.category}</span>
                  <span className="text-zinc-300">•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-zinc-400" />
                    <span>{distanceLabel}</span>
                  </span>
                </div>

                {/* Evidence Note */}
                <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-2.5 text-xs text-zinc-600 mb-3">
                  <p className="line-clamp-2 leading-relaxed">{evidenceNote}</p>
                  {check?.nextAction && (
                    <p className="mt-1.5 font-medium text-zinc-800 text-[11px] border-t border-zinc-200/60 pt-1">
                      Next step: {check.nextAction}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 pt-2.5 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => onGetDirections(place.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
                >
                  <Navigation className="h-3 w-3 text-zinc-300" />
                  <span>Directions</span>
                </button>

                <button
                  type="button"
                  onClick={() => onViewDetails(place.id)}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                  title="View store hours and details"
                  aria-label="View store details"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onContactStore(place.id)}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                  title="Contact store"
                  aria-label="Contact store"
                >
                  <Phone className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
