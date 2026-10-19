"use client";

import React, { useEffect, useRef, useState } from "react";
import { AssistantAvatar, type AssistantMode } from "@/components/AssistantAvatar";
import { Mic, Volume2, Square, X, Send, MapPin, Sparkles } from "lucide-react";
import { EvidenceBadge } from "./EvidenceBadge";
import type { InventoryStatus } from "@veylo/types";

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

interface AlexaSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: string;
  category?: string;
  storeName?: string;
  evidenceStatus?: string;
  answer?: string;
  userQuery?: string;
  confidence?: number;
  traceCount?: number;
  isLoading?: boolean;
  currentLocation?: string;
  onAskAlexa?: (promptText: string) => void;
}

const VOICE_SUGGESTIONS = [
  "I need that little thing that lets me connect my laptop to a TV.",
  "What is the white tape plumbers wrap around pipe threads?",
  "I need a cable to charge my phone.",
];

export function AlexaSimulationModal({
  isOpen,
  onClose,
  product,
  category,
  storeName,
  evidenceStatus,
  answer,
  userQuery,
  confidence,
  traceCount = 0,
  isLoading = false,
  currentLocation = "Austin, TX",
  onAskAlexa,
}: AlexaSimulationModalProps) {
  const [voiceInput, setVoiceInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const lastSpokenAnswerRef = useRef<string | undefined>(undefined);

  const effectiveMode: AssistantMode = isLoading
    ? "thinking"
    : isRecording
      ? "listening"
      : isSpeaking
        ? "speaking"
        : "idle";

  const speakText = (textToSpeak: string) => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !textToSpeak
    )
      return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  // Auto-speak new live agent answers when modal is open
  useEffect(() => {
    if (!isOpen || isLoading || !answer) return;
    if (lastSpokenAnswerRef.current !== answer) {
      lastSpokenAnswerRef.current = answer;
      speakText(answer);
    }
  }, [isOpen, isLoading, answer]);

  useEffect(() => {
    if (!isOpen) {
      stopSpeech();
      stopRecording();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopSpeech();
      stopRecording();
    };
  }, []);

  const handleTriggerQuery = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    stopSpeech();
    stopRecording();
    setVoiceInput("");
    if (onAskAlexa) {
      onAskAlexa(trimmed);
    }
  };

  const toggleVoiceRecording = () => {
    if (isRecording) {
      stopRecording();
      if (voiceInput.trim()) {
        handleTriggerQuery(voiceInput);
      }
      return;
    }

    stopSpeech();
    const win =
      typeof window !== "undefined"
        ? (window as unknown as Record<string, unknown>)
        : {};
    const SpeechRecognitionCtor = (win.SpeechRecognition ||
      win.webkitSpeechRecognition) as
      | (new () => BrowserSpeechRecognition)
      | undefined;

    if (!SpeechRecognitionCtor) {
      alert("Microphone voice recognition is not supported in this browser.");
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;

      let latestTranscript = "";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        latestTranscript = transcript;
        setVoiceInput(transcript);
      };

      recognition.onerror = () => {
        setIsRecording(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
        if (latestTranscript.trim()) {
          handleTriggerQuery(latestTranscript);
        }
      };

      recognitionRef.current = recognition;
      setIsRecording(true);
      recognition.start();
    } catch {
      setIsRecording(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/60 p-3 backdrop-blur-xs sm:p-6 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alexa-preview-title"
    >
      <section className="my-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="alexa-preview-title"
                className="text-sm font-semibold tracking-tight text-zinc-900"
              >
                Alexa+ Multimodal Simulation
              </h2>
              <p className="text-[11px] text-zinc-500">
                Echo Show canvas powered by live Veylo MCP tools
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Alexa preview"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Voice & Text Input Composer */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleTriggerQuery(voiceInput);
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={toggleVoiceRecording}
                disabled={isLoading}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all ${
                  isRecording
                    ? "bg-rose-600 text-white animate-quiet-pulse"
                    : "bg-zinc-900 text-white hover:bg-zinc-800"
                } disabled:opacity-40`}
                title={isRecording ? "Stop voice recording" : "Speak to Alexa"}
              >
                <Mic className="h-3.5 w-3.5" />
                <span>{isRecording ? "Listening..." : "Speak"}</span>
              </button>

              <input
                type="text"
                value={voiceInput}
                onChange={(e) => setVoiceInput(e.target.value)}
                placeholder={
                  isRecording ? "Listening to voice..." : "Or type what you would say..."
                }
                disabled={isLoading}
                className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-800 focus:outline-none"
              />

              <button
                type="submit"
                disabled={isLoading || !voiceInput.trim()}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-40 transition-colors"
                title="Send query"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>

            {/* Quick Utterances */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-zinc-200/60 pt-2 text-xs">
              <span className="text-[11px] text-zinc-400">Suggestions:</span>
              {VOICE_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleTriggerQuery(suggestion)}
                  className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                >
                  &ldquo;{suggestion}&rdquo;
                </button>
              ))}
            </div>
          </div>

          {/* Multimodal Device Screen Canvas */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs">
            {/* Canvas Status Bar */}
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <AssistantAvatar mode={effectiveMode} nav animationOnly />
                <span className="text-xs font-medium text-zinc-800">
                  {isLoading
                    ? `Reasoning with MCP (Step ${traceCount}/8)`
                    : product
                      ? "Result verified"
                      : "Ready"}
                </span>
              </div>
              <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                <MapPin className="h-3 w-3" />
                <span>{currentLocation}</span>
              </span>
            </div>

            {/* Canvas Body */}
            <div className="p-4 sm:p-5 space-y-3.5">
              {isLoading ? (
                <div className="py-10 text-center flex flex-col items-center justify-center gap-2.5">
                  <div className="h-6 w-6 rounded-full border-2 border-zinc-200 border-t-zinc-800 animate-quiet-spin" />
                  <p className="text-xs font-medium text-zinc-700">
                    Querying Veylo MCP tools in real-time...
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Evaluating product match & store inventory
                  </p>
                </div>
              ) : product || answer ? (
                <>
                  {/* User Utterance */}
                  {userQuery && (
                    <div className="ml-auto max-w-[85%] rounded-lg bg-zinc-100 px-3.5 py-2.5 text-xs text-zinc-800">
                      <span className="block text-[10px] uppercase font-semibold text-zinc-400 mb-0.5">
                        User voice
                      </span>
                      &ldquo;{userQuery}&rdquo;
                    </div>
                  )}

                  {/* Alexa Spoken Answer */}
                  {answer && (
                    <div className="max-w-[95%] rounded-lg border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-900">
                      <span className="block text-[10px] uppercase font-semibold text-zinc-500 mb-1">
                        Alexa response
                      </span>
                      <p className="leading-relaxed">{answer}</p>
                    </div>
                  )}

                  {/* Visual Product Card */}
                  {product && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase font-semibold text-zinc-400">
                            Identified
                          </span>
                          {confidence !== undefined && (
                            <span className="text-[11px] font-mono text-zinc-600">
                              {Math.round(confidence * 100)}% match
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-zinc-950 text-sm mt-0.5">
                          {product}
                        </h4>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {category || "General"}
                          {storeName ? ` · Nearest: ${storeName}` : ""}
                        </p>
                      </div>
                      <EvidenceBadge
                        status={(evidenceStatus as InventoryStatus) || "UNKNOWN"}
                        className="self-start sm:self-auto shrink-0"
                      />
                    </div>
                  )}

                  {/* Audio Control */}
                  {answer && (
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                      <button
                        type="button"
                        onClick={() =>
                          isSpeaking ? stopSpeech() : speakText(answer)
                        }
                        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                      >
                        {isSpeaking ? (
                          <>
                            <Square className="h-3 w-3 fill-current text-zinc-700" />
                            <span>Stop voice</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-3.5 w-3.5 text-zinc-600" />
                            <span>Replay audio</span>
                          </>
                        )}
                      </button>
                      <span className="text-[11px] text-zinc-400">
                        Web Speech API
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center text-xs text-zinc-400">
                  <p className="font-medium text-zinc-600 mb-1">
                    Ready for voice inquiry
                  </p>
                  <p className="max-w-xs mx-auto">
                    Speak into your microphone or pick a suggested query to test the Alexa+ physical shopping flow.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
