"use client";

import React, { useState } from "react";
import { HelpCircle, CornerDownLeft } from "lucide-react";

interface ClarificationCardProps {
  question: {
    field: "product" | "urgency" | "location";
    text: string;
  };
  onAnswer: (answer: string) => void;
  isLoading: boolean;
}

export function ClarificationCard({ question, onAnswer, isLoading }: ClarificationCardProps) {
  const [customAnswer, setCustomAnswer] = useState("");

  // Determine smart quick-reply suggestions based on the question text
  const getSuggestions = () => {
    const q = question.text.toLowerCase();
    if (q.includes("today") || q.includes("online") || question.field === "urgency") {
      return ["Yes, I need one nearby today", "I can wait, online order is fine"];
    }
    if (q.includes("usb-c") || q.includes("lightning") || q.includes("connector")) {
      return ["USB-C", "Lightning", "Micro-USB"];
    }
    if (q.includes("hdmi") || q.includes("port") || q.includes("hub")) {
      return ["Just HDMI", "HDMI and extra USB ports", "A full multi-port hub"];
    }
    if (q.includes("where") || q.includes("location") || question.field === "location") {
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
    <div className="w-full max-w-4xl mx-auto my-6 p-5 sm:p-6 bg-amber-50/60 border border-amber-200/80 rounded-2xl shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
          <HelpCircle className="w-4 h-4 text-amber-700" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Clarification Needed
            </span>
            <span className="text-[11px] text-amber-700/80 font-medium">
              (Improves Accuracy)
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-2">
            &ldquo;{question.text}&rdquo;
          </h3>

          <p className="text-xs text-slate-600 mb-4">
            Veylo avoids guessing when ambiguity materially impacts real-world store availability.
          </p>

          {/* Quick-choice suggestions */}
          <div className="flex flex-wrap gap-2 mb-4">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onAnswer(s)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 text-xs font-medium text-slate-800 border border-amber-200 hover:border-amber-300 transition-colors shadow-2xs"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Custom text response input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={customAnswer}
              onChange={(e) => setCustomAnswer(e.target.value)}
              placeholder="Or type your specific requirement here..."
              disabled={isLoading}
              className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white border border-amber-200 rounded-lg focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={isLoading || !customAnswer.trim()}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center gap-1.5"
            >
              <span>Reply</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

