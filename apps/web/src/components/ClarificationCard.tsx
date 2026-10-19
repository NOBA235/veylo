"use client";

import React, { useState } from "react";
import { HelpCircle, ArrowRight } from "lucide-react";

interface ClarificationCardProps {
  question: {
    field: "product" | "urgency" | "location";
    text: string;
  };
  onAnswer: (answer: string) => void;
  isLoading: boolean;
}

export function ClarificationCard({
  question,
  onAnswer,
  isLoading,
}: ClarificationCardProps) {
  const [customAnswer, setCustomAnswer] = useState("");

  const getSuggestions = () => {
    const q = question.text.toLowerCase();
    if (
      q.includes("today") ||
      q.includes("online") ||
      question.field === "urgency"
    ) {
      return ["Need it nearby today", "Online delivery is fine"];
    }
    if (
      q.includes("usb-c") ||
      q.includes("lightning") ||
      q.includes("connector")
    ) {
      return ["USB-C", "Lightning", "Micro-USB"];
    }
    if (q.includes("hdmi") || q.includes("port") || q.includes("hub")) {
      return ["Standard HDMI", "HDMI adapter", "Multi-port hub"];
    }
    if (
      q.includes("where") ||
      q.includes("location") ||
      question.field === "location"
    ) {
      return ["Austin, TX", "Current location", "Nearby downtown"];
    }
    return ["Yes", "No", "Either is fine"];
  };

  const suggestions = getSuggestions();

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!customAnswer.trim() || isLoading) return;
    onAnswer(customAnswer.trim());
    setCustomAnswer("");
  };

  return (
    <div className="w-full rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 sm:p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
          <HelpCircle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              Clarification
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-xs text-zinc-500">
              Helps confirm exact store inventory
            </span>
          </div>

          <h3 className="text-sm sm:text-base font-semibold text-zinc-900 mb-1">
            {question.text}
          </h3>

          <p className="text-xs text-zinc-500 mb-3.5">
            Select an option or type a quick reply to continue search.
          </p>

          {/* Quick choices */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onAnswer(suggestion)}
                disabled={isLoading}
                className="rounded-md border border-amber-200/80 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 transition-colors hover:border-amber-300 hover:bg-amber-50/80 disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {/* Custom reply input */}
          <form onSubmit={handleSubmit} className="flex gap-1.5">
            <input
              type="text"
              value={customAnswer}
              onChange={(e) => setCustomAnswer(e.target.value)}
              placeholder="Or type a specific requirement..."
              disabled={isLoading}
              className="w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-800 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !customAnswer.trim()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-40"
            >
              <span>Reply</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
