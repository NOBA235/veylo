"use client";

import React, { useState } from "react";
import { Search, Mic, Image as ImageIcon, MapPin, CornerDownLeft, Sparkles } from "lucide-react";
import type { Urgency } from "@veylo/types";

interface SearchHeroProps {
  onSearch: (params: {
    message: string;
    location: string;
    urgency?: Urgency;
    compatibility?: string;
  }) => void;
  isLoading: boolean;
  currentLocation: string;
  onLocationChange: (loc: string) => void;
}

export function SearchHero({
  onSearch,
  isLoading,
  currentLocation,
  onLocationChange,
}: SearchHeroProps) {
  const [query, setQuery] = useState("");
  const [urgency, setUrgency] = useState<Urgency | undefined>("today");
  const [compatibility, setCompatibility] = useState<string>("");
  const [isListening, setIsListening] = useState(false);
  const [showLocationEdit, setShowLocationEdit] = useState(false);
  const [locInput, setLocInput] = useState(currentLocation);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isLoading) return;
    onSearch({
      message: query.trim(),
      location: currentLocation,
      urgency,
      compatibility: compatibility.trim() || undefined,
    });
  };

  const handleQuickPrompt = (promptText: string, defaultUrgency: Urgency = "today", defaultCompat?: string) => {
    setQuery(promptText);
    setUrgency(defaultUrgency);
    if (defaultCompat) setCompatibility(defaultCompat);
    onSearch({
      message: promptText,
      location: currentLocation,
      urgency: defaultUrgency,
      compatibility: defaultCompat || compatibility.trim() || undefined,
    });
  };

  const toggleMic = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }
    setIsListening(true);
    // Simulate speech-to-text input after 1.5s
    setTimeout(() => {
      setQuery("I need that little thing that lets me connect my laptop to a TV. I don't know what it's called.");
      setIsListening(false);
    }, 1800);
  };

  return (
    <div className="w-full max-w-4xl mx-auto pt-6 pb-4">
      {/* Ambiguity Welcome */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Ambiguous Physical Shopping Capability</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight mb-2">
          What are you trying to find?
        </h1>
        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
          Don&apos;t know the name? Don&apos;t know the store? Describe what it does or what it looks like.
        </p>
      </div>

      {/* Main Search Input Form */}
      <form onSubmit={handleSubmit} className="relative mb-4">
        <div className="relative flex flex-col bg-white border border-slate-300 rounded-2xl shadow-sm hover:border-slate-400 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 transition-all p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <Search className="w-5 h-5 text-slate-400 mt-1 shrink-0" />
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={2}
              placeholder="e.g. 'I need that little thing that lets me connect my laptop to a TV. I don't know what it's called...'"
              className="w-full resize-none border-0 p-0 text-slate-900 placeholder:text-slate-400 focus:ring-0 text-sm sm:text-base leading-relaxed bg-transparent outline-none"
              disabled={isLoading}
            />
          </div>

          {/* Controls Bar inside Input */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-100">
            {/* Quick Context Chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Location Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLocationEdit(!showLocationEdit)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{currentLocation}</span>
                </button>
                {showLocationEdit && (
                  <div className="absolute top-8 left-0 z-50 w-64 p-2 bg-white rounded-lg shadow-lg border border-slate-200">
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Search Location</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={locInput}
                        onChange={(e) => setLocInput(e.target.value)}
                        placeholder="e.g. Austin, TX"
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onLocationChange(locInput.trim() || "Austin, TX");
                          setShowLocationEdit(false);
                        }}
                        className="px-2 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-800"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Urgency Selector */}
              <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-md border border-slate-200">
                <button
                  type="button"
                  onClick={() => setUrgency("today")}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    urgency === "today"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Nearby Today
                </button>
                <button
                  type="button"
                  onClick={() => setUrgency("this_week")}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    urgency === "this_week"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => setUrgency("online")}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    urgency === "online"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Online Only
                </button>
              </div>
            </div>

            {/* Input Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Mic / Voice Simulation */}
              <button
                type="button"
                onClick={toggleMic}
                className={`p-2 rounded-lg border transition-all ${
                  isListening
                    ? "bg-red-50 border-red-300 text-red-600 animate-pulse"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
                title="Voice input simulation"
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Image Input (Feature flag preview) */}
              <button
                type="button"
                onClick={() => alert("Image identification is available behind ENABLE_IMAGE_IDENTIFICATION=true in Phase 6.")}
                className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Visual product photo upload (Phase 6)"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white font-medium text-xs sm:text-sm hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Investigating...</span>
                  </>
                ) : (
                  <>
                    <span>Identify & Find</span>
                    <CornerDownLeft className="w-3.5 h-3.5 text-slate-400" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Killer Demos / Quick Prompts */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-700 shrink-0">Try standard hackathon tests:</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              handleQuickPrompt(
                "I need that little thing that lets me connect my laptop to a TV. I don't know what it's called.",
                "today",
                "USB-C"
              )
            }
            className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300 transition-colors text-left"
          >
            🔌 Laptop to TV Adapter <span className="text-slate-400 font-mono">(Killer Demo)</span>
          </button>
          <button
            type="button"
            onClick={() =>
              handleQuickPrompt("I need the white tape plumbers use around pipe threads.")
            }
            className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300 transition-colors text-left"
          >
            🔧 Plumber&apos;s White Tape <span className="text-slate-400 font-mono">(Second Demo)</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickPrompt("I need a cable to charge my phone.")}
            className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300 transition-colors text-left"
          >
            📱 Phone Cable <span className="text-slate-400 font-mono">(Clarification Demo)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

