"use client";

import React, { useEffect, useRef, useState } from "react";
import { Search, Mic, MapPin, ArrowRight, X, Check } from "lucide-react";
import type { Urgency } from "@veylo/types";
import { AssistantAvatar, type AssistantMode } from "@/components/AssistantAvatar";

interface SpeechRecognitionEventResult {
  0: { transcript: string };
  isFinal: boolean;
}

interface SpeechRecognitionEvent {
  results: {
    length: number;
    [index: number]: SpeechRecognitionEventResult;
  };
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

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

const EXAMPLE_PROMPTS = [
  {
    label: "Laptop to TV adapter",
    query: "I need that little thing that lets me connect my laptop to a TV. I don't know what it's called.",
    urgency: "today" as Urgency,
    compatibility: "USB-C",
  },
  {
    label: "Plumber's pipe thread tape",
    query: "I need the white tape plumbers use around pipe threads.",
    urgency: "today" as Urgency,
  },
  {
    label: "Phone fast-charging cable",
    query: "I need a fast charging cable for my phone.",
    urgency: "today" as Urgency,
  },
  {
    label: "Bike valve adapter",
    query: "An adapter so I can pump my road bike tire with a gas station air pump.",
    urgency: "today" as Urgency,
  },
];

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
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [showLocationEdit, setShowLocationEdit] = useState(false);
  const [locInput, setLocInput] = useState(currentLocation);
  const locationPopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocInput(currentLocation);
  }, [currentLocation]);

  useEffect(() => {
    return () => {
      if (listeningTimer.current) clearTimeout(listeningTimer.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Close location popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        locationPopRef.current &&
        !locationPopRef.current.contains(event.target as Node)
      ) {
        setShowLocationEdit(false);
      }
    }
    if (showLocationEdit) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showLocationEdit]);

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

  const handleQuickPrompt = (
    promptText: string,
    defaultUrgency: Urgency = "today",
    defaultCompat?: string
  ) => {
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
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
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

    const win =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>)
        : {};
    const SpeechRecognitionCtor = (win.SpeechRecognition ||
      win.webkitSpeechRecognition) as
      | (new () => BrowserSpeechRecognition)
      | undefined;

    if (SpeechRecognitionCtor) {
      try {
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = "en-US";
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let transcript = "";
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript.trim()) {
            setQuery(transcript);
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
          onListeningChange(false);
          recognitionRef.current = null;
        };

        recognition.onend = () => {
          setIsListening(false);
          onListeningChange(false);
          recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        setIsListening(true);
        onListeningChange(true);
        recognition.start();
        return;
      } catch {
        // Fallback if browser permission fails
      }
    }

    // Fallback simulation for testing
    setIsListening(true);
    onListeningChange(true);
    listeningTimer.current = setTimeout(() => {
      setQuery(
        "I need that little thing that lets me connect my laptop to a TV. I don't know what it's called."
      );
      setIsListening(false);
      onListeningChange(false);
      listeningTimer.current = null;
    }, 1800);
  };

  return (
    <section className="mx-auto w-full max-w-3xl pt-4 pb-2 sm:pt-8 sm:pb-4">
      {/* Centered Alexa+ AI Assistant Avatar */}
      <div className="flex flex-col items-center justify-center mb-4 sm:mb-5">
        <button
          type="button"
          onClick={toggleMic}
          disabled={isLoading}
          aria-label={isListening ? "Listening... click to stop" : "Speak to Alexa+"}
          className="relative group p-1.5 rounded-full transition-all hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          title={isListening ? "Listening... Click to stop" : "Click to speak with Alexa+"}
        >
          <AssistantAvatar
            mode={isListening ? "listening" : assistantMode}
            size="lg"
            animationOnly
          />
        </button>
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100/80 border border-zinc-200/80 text-[11px] font-medium text-zinc-600">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isListening
                ? "bg-amber-500 animate-ping"
                : assistantMode === "thinking"
                  ? "bg-cyan-500 animate-spin"
                  : assistantMode === "speaking"
                    ? "bg-cyan-600"
                    : "bg-cyan-500"
            }`}
          />
          <span>
            {isListening
              ? "Alexa+ Listening..."
              : assistantMode === "thinking"
                ? "Reasoning with MCP..."
                : assistantMode === "speaking"
                  ? "Speaking..."
                  : "Alexa+ Ready"}
          </span>
        </div>
      </div>

      {/* Editorial Title */}
      <div className="mb-5 text-center sm:mb-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-zinc-950">
          Find what you need in local stores
        </h1>
        <p className="mt-2 text-xs sm:text-sm md:text-base text-zinc-500 max-w-xl mx-auto leading-relaxed">
          Describe what the item looks like, what it does, or what it connects to.
          Veylo identifies the product and checks shelf availability.
        </p>
      </div>

      {/* Main Search Composer */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs transition-all focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-400/20"
      >
        {/* Input Area */}
        <div className="p-3 sm:p-4 pb-2">
          <div className="flex items-start gap-2.5">
            <Search className="mt-1 h-4 w-4 shrink-0 text-zinc-400" />
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
              placeholder="e.g. I need that little thing that lets me connect my laptop to a TV..."
              className="w-full min-w-0 resize-none border-0 bg-transparent p-0 text-sm leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400 focus:outline-none focus:ring-0 sm:text-base"
              disabled={isLoading}
              aria-label="Describe what you are looking for"
            />
            {query && !isLoading && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-0.5 shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
                title="Clear input"
                aria-label="Clear input"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Composer Controls Bar */}
        <div className="flex flex-col gap-2 border-t border-zinc-100 bg-zinc-50/50 p-2.5 sm:p-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Location & Urgency Context */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Location Selector */}
            <div className="relative" ref={locationPopRef}>
              <button
                type="button"
                onClick={() => setShowLocationEdit(!showLocationEdit)}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
                title="Change search location"
              >
                <MapPin className="h-3 w-3 text-zinc-400 shrink-0" />
                <span className="max-w-[7.5rem] sm:max-w-[10rem] truncate">{currentLocation}</span>
              </button>

              {showLocationEdit && (
                <div className="absolute top-8 left-0 z-50 w-60 rounded-lg border border-zinc-200 bg-white p-2.5 shadow-lg">
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Search location
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={locInput}
                      onChange={(e) => setLocInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onLocationChange(locInput.trim() || "Austin, TX");
                          setShowLocationEdit(false);
                        }
                      }}
                      placeholder="e.g. Austin, TX"
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-900 focus:border-zinc-800 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onLocationChange(locInput.trim() || "Austin, TX");
                        setShowLocationEdit(false);
                      }}
                      className="inline-flex items-center justify-center rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Urgency Segmented Control */}
            <div className="inline-flex rounded-md border border-zinc-200 bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setUrgency("today")}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  urgency === "today"
                    ? "bg-zinc-900 text-white shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setUrgency("this_week")}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  urgency === "this_week"
                    ? "bg-zinc-900 text-white shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                This week
              </button>
              <button
                type="button"
                onClick={() => setUrgency("online")}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  urgency === "online"
                    ? "bg-zinc-900 text-white shadow-2xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Online
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-1.5 pt-1 sm:pt-0 border-t border-zinc-100 sm:border-0">
            {/* Voice Input */}
            <button
              type="button"
              onClick={toggleMic}
              disabled={isLoading}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                isListening
                  ? "bg-rose-50 border border-rose-200 text-rose-700 animate-quiet-pulse"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
              title={isListening ? "Listening... click to stop" : "Speak request"}
              aria-label={isListening ? "Stop listening" : "Start voice input"}
            >
              <Mic className="h-3 w-3" />
              <span>{isListening ? "Listening..." : "Speak"}</span>
            </button>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? (
                <>
                  <div className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-quiet-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Find</span>
                  <ArrowRight className="h-3 w-3 text-zinc-400" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Understated Example Prompts */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
        <span className="text-zinc-400 font-normal mr-0.5 text-[11px]">Suggestions:</span>
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt.label}
            type="button"
            onClick={() =>
              handleQuickPrompt(
                prompt.query,
                prompt.urgency,
                prompt.compatibility
              )
            }
            className="rounded-md border border-zinc-200/80 bg-white px-2 py-0.5 text-[11px] text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
          >
            {prompt.label}
          </button>
        ))}
      </div>
    </section>
  );
}
