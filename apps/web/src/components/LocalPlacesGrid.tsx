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
      <div className="w-full bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 mb-6">
        <Store className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-700">No matching local stores discovered nearby.</p>
        <p className="text-xs text-slate-500 mt-1">Try widening your search radius or checking online delivery options.</p>
      </div>
    );
  }

  return (
    <div className="w-full mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">Nearby Store Options</h3>
          <span className="text-xs text-slate-500">({places.length} found)</span>
        </div>
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          Real OSM Geodata
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {places.map((place) => {
          const check = checks[place.id];
          const status = check?.status ?? place.inventoryStatus ?? "UNKNOWN";
          const confidence = check?.confidence;
          const isBest = place.id === bestPlaceId;

          return (
            <div
              key={place.id}
              className={`flex flex-col justify-between p-5 rounded-2xl border transition-all ${
                isBest
                  ? "bg-white border-blue-400 ring-2 ring-blue-50 shadow-sm"
                  : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
              }`}
            >
              <div>
                {/* Header: Name & Status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    {isBest && (
                      <span className="inline-block px-2 py-0.5 mb-1 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 rounded">
                        Top Option
                      </span>
                    )}
                    <h4 className="font-semibold text-slate-900 text-base leading-snug">
                      {place.name || `Local ${place.category}`}
                    </h4>
                    <p className="text-xs text-slate-500 capitalize">{place.category}</p>
                  </div>
                  <EvidenceBadge status={status} confidence={confidence} />
                </div>

                {/* Distance & Source */}
                <div className="flex items-center gap-3 text-xs text-slate-500 my-2">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {place.distanceMeters !== undefined
                        ? place.distanceMeters < 1000
                          ? `${place.distanceMeters}m away`
                          : `${(place.distanceMeters / 1000).toFixed(1)}km away`
                        : "Distance unknown"}
                    </span>
                  </div>
                  <span>•</span>
                  <span className="text-[11px] text-slate-400">{place.source}</span>
                </div>

                {/* Honest Evidence Note */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 my-3">
                  <p className="line-clamp-2">
                    {check?.evidence?.[0]?.evidenceSummary ??
                      place.evidenceSummary ??
                      "Category matches product, but on-shelf inventory is unverified."}
                  </p>
                  {check?.nextAction && (
                    <p className="mt-1 font-medium text-slate-800 text-[11px]">
                      Next action: {check.nextAction}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onGetDirections(place.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
                >
                  <Navigation className="w-3 h-3 text-slate-300" />
                  <span>Directions</span>
                </button>

                <button
                  type="button"
                  onClick={() => onViewDetails(place.id)}
                  className="flex items-center justify-center p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="View Store Details"
                >
                  <Info className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onContactStore(place.id)}
                  className="flex items-center justify-center p-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Contact Store"
                >
                  <Phone className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

