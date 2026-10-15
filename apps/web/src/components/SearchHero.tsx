"use client";

import React, { useEffect, useRef, useState } from "react";
import { Search, Mic, Image as ImageIcon, MapPin, CornerDownLeft, Sparkles, X } from "lucide-react";
import type { Urgency } from "@veylo/types";
import { AssistantAvatar, type AssistantMode } from "@/components/AssistantAvatar";

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
  assistantMode: AssistantMode;
  onListeningChange: (listening: boolean) => void;
}

export function SearchHero({
  onSearch,
  isLoading,
  currentLocation,
  onLocationChange,
  assistantMode,
  onListeningChange,
}: SearchHeroProps) {
  const [query, setQuery] = useState("");
  const [urgency, setUrgency] = useState<Urgency | undefined>("today");
  const [compatibility, setCompatibility] = useState<string>("");
  const [isListening, setIsListening] = useState(false);
  const listeningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showLocationEdit, setShowLocationEdit] = useState(false);
  const [locInput, setLocInput] = useState(currentLocation);

  useEffect(() => () => {
    if (listeningTimer.current) clearTimeout(listeningTimer.current);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isLoading) return;
    cancelListeningPreview();
    onSearch({
      message: query.trim(),
      location: currentLocation,
      urgency,
      compatibility: compatibility.trim() || undefined,
    });
  };

  const handleQuickPrompt = (promptText: string, defaultUrgency: Urgency = "today", defaultCompat?: string) => {
    cancelListeningPreview();
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

  const cancelListeningPreview = () => {
    if (listeningTimer.current) {
      clearTimeout(listeningTimer.current);
      listeningTimer.current = null;
    }
    if (isListening) {
      setIsListening(false);
      onListeningChange(false);
    }
  };

  const toggleMic = () => {
    if (isListening) {
      cancelListeningPreview();
      return;
    }
    setIsListening(true);
    onListeningChange(true);
    // Simulate speech-to-text input after 1.5s
    listeningTimer.current = setTimeout(() => {
      setQuery("I need that little thing that lets me connect my laptop to a TV. I don't know what it's called.");
      setIsListening(false);
      onListeningChange(false);
      listeningTimer.current = null;
    }, 1800);
  };

  return (
    <div className="mx-auto w-full max-w-4xl pt-4 pb-4 sm:pt-6">
      {/* Ambiguity Welcome */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Ambiguous Physical Shopping Capability</span>
        </div>
        <div className="mb-2 flex items-center justify-center gap-2.5 sm:gap-4">
          <AssistantAvatar mode={isListening ? "listening" : assistantMode} compact />
          <h1 className="max-w-[17ch] text-left text-xl font-semibold tracking-tight text-slate-900 sm:max-w-none sm:text-4xl">
            What are you trying to find?
          </h1>
        </div>
        <p className="mx-auto max-w-2xl px-2 text-sm text-slate-600 sm:px-0 sm:text-base">
          Don&apos;t know the name? Don&apos;t know the store? Describe what it does or what it looks like.
        </p>
      </div>

      {/* Main Search Input Form */}
      <form onSubmit={handleSubmit} className="relative mb-4">
        <div className="relative flex flex-col rounded-2xl border border-slate-300 bg-white p-3 shadow-sm transition-all hover:border-slate-400 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 sm:p-4">
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
              className="w-full min-w-0 resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 sm:text-base pr-6"
              disabled={isLoading}
            />
            {query && !isLoading && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors shrink-0 mt-0.5"
                title="Clear input"
                aria-label="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Controls Bar inside Input */}
          <div className="mt-2 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
            {/* Quick Context Chips */}
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
              {/* Location Pill */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLocationEdit(!showLocationEdit)}
                  className="flex min-h-9 max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span className="max-w-[13rem] truncate">{currentLocation}</span>
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
                        className="w-full min-w-0 rounded border border-slate-300 px-2 py-2 text-xs focus:border-slate-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onLocationChange(locInput.trim() || "Austin, TX");
                          setShowLocationEdit(false);
                        }}
                        className="min-h-9 rounded bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-800"
                      >
                        Set
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Urgency Selector */}
              <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setUrgency("today")}
                  className={`min-h-8 shrink-0 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
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
                  className={`min-h-8 shrink-0 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
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
                  className={`min-h-8 shrink-0 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
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
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {/* Mic / Voice Simulation */}
              <button
                type="button"
                onClick={toggleMic}
                disabled={isLoading}
                className={`min-h-10 min-w-10 rounded-lg border p-2 transition-all ${
                  isLoading
                    ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                    : isListening
                    ? "bg-red-50 border-red-300 text-red-600 animate-pulse"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
                title="Voice preview · no audio is recorded"
                aria-label={isListening ? "Stop listening preview" : "Start listening preview"}
              >
                <Mic className="w-4 h-4" />
              </button>
              <span className="-ml-1 mr-auto text-[10px] text-slate-400 sm:mr-0">Preview</span>

              {/* Image Input (Feature flag preview) */}
              <button
                type="button"
                onClick={() => alert("Image identification is available behind ENABLE_IMAGE_IDENTIFICATION=true in Phase 6.")}
                className="min-h-10 min-w-10 rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title="Visual product photo upload (Phase 6)"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-4 sm:text-sm"
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

      {/* Popular Inquiries / Quick Prompts */}
      <div className="flex flex-col items-start gap-2 text-xs text-slate-500 sm:flex-row sm:items-center">
        <span className="font-medium text-slate-700 shrink-0">Popular searches:</span>
        <div className="flex w-full flex-nowrap gap-1.5 overflow-x-auto pb-1 sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0">
          <button
            type="button"
            onClick={() =>
              handleQuickPrompt(
                "I need that little thing that lets me connect my laptop to a TV. I don't know what it's called.",
                "today",
                "USB-C"
              )
            }
            className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 font-medium"
          >
            🔌 Laptop to TV Adapter
          </button>
          <button
            type="button"
            onClick={() =>
              handleQuickPrompt("I need the white tape plumbers use around pipe threads.")
            }
            className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 font-medium"
          >
            🔧 Plumber&apos;s Seal Tape
          </button>
          <button
            type="button"
            onClick={() => handleQuickPrompt("I need a cable to charge my phone.")}
            className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 font-medium"
          >
            📱 Phone Charging Cable
          </button>
        </div>
      </div>
    </div>
  );
}

