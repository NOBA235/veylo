"use client";

import React, { useEffect, useState } from "react";
import { AssistantAvatar, type AssistantMode } from "@/components/AssistantAvatar";
import { Headphones, Mic, Volume2, X } from "lucide-react";

interface AlexaSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: string;
  category?: string;
  storeName?: string;
  evidenceStatus?: string;
}

type ScenarioKey = "adapter" | "tape" | "current";

interface Scenario {
  label: string;
  prompt: string;
  product: string;
  category: string;
  status: string;
  response: string;
  isExample: boolean;
}

const EXAMPLES: Record<Exclude<ScenarioKey, "current">, Scenario> = {
  adapter: {
    label: "Laptop to TV",
    prompt: "I need the little thing that connects my laptop to a TV.",
    product: "USB-C to HDMI adapter",
    category: "Video adapter",
    status: "Stock not verified",
    response:
      "You may mean a USB-C to HDMI adapter. I can help find nearby places to check, but shelf stock needs to be confirmed.",
    isExample: true,
  },
  tape: {
    label: "Plumber’s tape",
    prompt: "What’s the white tape plumbers wrap around pipe threads?",
    product: "PTFE thread seal tape",
    category: "Plumbing",
    status: "Stock not verified",
    response:
      "That sounds like PTFE thread seal tape. I can help find a nearby store; current shelf stock isn’t verified.",
    isExample: true,
  },
};

const statusFor = (status?: string) => {
  switch (status) {
    case "CONFIRMED":
      return "Stock confirmed";
    case "LIKELY":
      return "Online listing found · shelf stock unconfirmed";
    case "WEB_FOUND":
      return "Found online · local stock unconfirmed";
    default:
      return "Stock not verified";
  }
};

const statusStyleFor = (status?: string) => {
  switch (status) {
    case "CONFIRMED":
      return "bg-emerald-100 text-emerald-900";
    case "LIKELY":
      return "bg-amber-100 text-amber-900";
    case "WEB_FOUND":
      return "bg-blue-100 text-blue-900";
    default:
      return "bg-slate-200 text-slate-700";
  }
};

export function AlexaSimulationModal({
  isOpen,
  onClose,
  product,
  category,
  storeName,
  evidenceStatus,
}: AlexaSimulationModalProps) {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>("adapter");
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("idle");

  const hasCurrentResult = Boolean(product);
  const currentScenario: Scenario = {
    label: "Current result",
    prompt: product ? `Help me find a ${product}.` : "Your latest product search will appear here.",
    product: product ?? "No search yet",
    category: category ?? "Product match",
    status: statusFor(evidenceStatus),
    response: product
      ? storeName
        ? `I found ${storeName} as a nearby place to check. ${statusFor(evidenceStatus)}. Would you like to hear the next step?`
        : `I found a match for ${product}. ${statusFor(evidenceStatus)}. Would you like help finding a nearby place?`
      : "Try one of the sample requests to preview the conversation.",
    isExample: false,
  };

  const scenario = selectedScenario === "current" ? currentScenario : EXAMPLES[selectedScenario];

  const speakResponse = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setAssistantMode("thinking");
    const utterance = new SpeechSynthesisUtterance(scenario.response);
    utterance.rate = 1.02;
    utterance.pitch = 1.05;
    utterance.onstart = () => setAssistantMode("speaking");
    utterance.onend = () => setAssistantMode("idle");
    utterance.onerror = () => setAssistantMode("idle");
    window.speechSynthesis.speak(utterance);
  };

  const toggleListeningPreview = () => {
    if (assistantMode === "listening") {
      setAssistantMode("thinking");
      window.setTimeout(() => setAssistantMode((mode) => (mode === "thinking" ? "idle" : mode)), 800);
      return;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setAssistantMode("listening");
  };

  const chooseScenario = (key: ScenarioKey) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setAssistantMode("idle");
    setSelectedScenario(key);
  };

  useEffect(() => {
    if (!isOpen) return;
    setSelectedScenario(product ? "current" : "adapter");
    setAssistantMode("idle");
  }, [isOpen, product]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
      <section
        aria-labelledby="voice-preview-title"
        aria-modal="true"
        role="dialog"
        className="my-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-[#f8fafc] text-slate-900 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-700">Veylo</p>
            <h2 id="voice-preview-title" className="mt-0.5 text-lg font-semibold tracking-tight">
              Voice preview
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close voice preview"
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-7">
          <p className="mb-4 text-sm text-slate-600">Choose a request to see how Veylo could answer.</p>

          <div className="mb-5 flex flex-wrap gap-2" aria-label="Preview examples">
            {(["adapter", "tape"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => chooseScenario(key)}
                aria-pressed={selectedScenario === key}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  selectedScenario === key
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {EXAMPLES[key].label}
              </button>
            ))}
            {hasCurrentResult && (
              <button
                type="button"
                onClick={() => chooseScenario("current")}
                aria-pressed={selectedScenario === "current"}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  selectedScenario === "current"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                Current result
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-5 py-5 sm:px-7">
              <AssistantAvatar mode={assistantMode} />
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-slate-200">
                {scenario.isExample ? "Sample preview" : "From your search"}
              </span>
            </div>

            <div className="space-y-4 p-5 sm:p-7">
              <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-700">
                {scenario.prompt}
              </div>

              <div className="max-w-[95%] rounded-2xl rounded-tl-sm border border-cyan-100 bg-cyan-50/70 px-4 py-3 text-sm leading-relaxed text-slate-800">
                {scenario.response}
              </div>

              <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Possible match</p>
                  <p className="mt-1 font-semibold text-slate-900">{scenario.product}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{scenario.category}</p>
                </div>
                <span className={`max-w-[52%] rounded-full px-3 py-1 text-right text-[11px] font-medium leading-snug ${scenario.isExample ? "bg-slate-200 text-slate-700" : statusStyleFor(evidenceStatus)}`}>
                  {scenario.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={speakResponse}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-800"
                >
                  <Volume2 className="h-4 w-4" />
                  Hear response
                </button>
                <button
                  type="button"
                  onClick={toggleListeningPreview}
                  aria-pressed={assistantMode === "listening"}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                    assistantMode === "listening"
                      ? "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Mic className="h-4 w-4" />
                  {assistantMode === "listening" ? "Stop preview" : "Preview listening"}
                </button>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 sm:ml-auto">
                  <Headphones className="h-3.5 w-3.5" />
                  Listening is animated; no audio is recorded
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
