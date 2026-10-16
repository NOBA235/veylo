"use client";

import React, { useEffect, useRef, useState } from "react";
import { AssistantAvatar, type AssistantMode } from "@/components/AssistantAvatar";
import { Mic, Volume2, Square, X, Send, Sparkles, Radio, MapPin, ShieldCheck } from "lucide-react";

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
      return "bg-emerald-100 text-emerald-900 border-emerald-300";
    case "LIKELY":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "WEB_FOUND":
      return "bg-blue-100 text-blue-900 border-blue-300";
    default:
      return "bg-slate-200 text-slate-700 border-slate-300";
  }
};

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
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !textToSpeak) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.02;
    utterance.pitch = 1.02;
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

  // Auto-speak new live agent answers when the modal is open
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
    const win = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : {};
    const SpeechRecognitionCtor = (win.SpeechRecognition || win.webkitSpeechRecognition) as
      | (new () => BrowserSpeechRecognition)
      | undefined;

    if (!SpeechRecognitionCtor) {
      alert("Your browser does not support Web Speech API microphone recognition. Please type your request below or use Chrome/Edge.");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6 animate-in fade-in duration-150">
      <section
        aria-labelledby="voice-preview-title"
        aria-modal="true"
        role="dialog"
        className="my-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-[#f8fafc] text-slate-900 shadow-2xl"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-700">
                <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                Alexa+ Live Voice & Multimodal Interface
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                Echo Show 10 Canvas
              </span>
            </div>
            <h2 id="voice-preview-title" className="mt-0.5 text-base sm:text-lg font-semibold tracking-tight text-slate-900">
              Speak or ask anything — connected live to Veylo MCP
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Alexa+ interface"
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-7 space-y-5">
          {/* Live Voice / Text Input Bar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
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
                className={`flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-semibold transition-all ${
                  isRecording
                    ? "bg-rose-600 text-white animate-pulse shadow-md"
                    : "bg-cyan-700 text-white hover:bg-cyan-800 shadow-xs"
                } disabled:opacity-50`}
                title={isRecording ? "Stop and send voice request" : "Click and speak into your microphone"}
              >
                <Mic className="h-4 w-4" />
                <span>{isRecording ? "Listening... (Click to Send)" : "Speak to Alexa"}</span>
              </button>

              <input
                type="text"
                value={voiceInput}
                onChange={(e) => setVoiceInput(e.target.value)}
                placeholder={isRecording ? "Speak now..." : "Or type what you say to Alexa..."}
                disabled={isLoading}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:outline-none"
              />

              <button
                type="submit"
                disabled={isLoading || !voiceInput.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-40"
                title="Send to Alexa+ Agent"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            {/* Quick Voice Utterances */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-medium text-slate-400 mr-1">Try saying:</span>
              {VOICE_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleTriggerQuery(suggestion)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-900 disabled:opacity-50"
                >
                  &ldquo;{suggestion}&rdquo;
                </button>
              ))}
            </div>
          </div>

          {/* Echo Show 10 Multimodal Display Screen */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {/* Echo Show Top Status Bar */}
            <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-5 py-5 sm:px-7">
              <AssistantAvatar mode={effectiveMode} />
              <div className="flex flex-col items-end gap-1.5">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-cyan-200 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  {isLoading
                    ? `Running MCP Planner (Step ${traceCount}/8)`
                    : product
                      ? `Live Result · ${traceCount} MCP steps`
                      : "Ready for Voice Input"}
                </span>
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {currentLocation}
                </span>
              </div>
            </div>

            {/* Echo Show Main Canvas Body */}
            <div className="space-y-4 p-5 sm:p-7">
              {isLoading ? (
                <div className="py-10 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-3 border-cyan-200 border-t-cyan-700 rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-slate-800">
                    Alexa+ is invoking Veylo MCP tools in real time...
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    Step {traceCount}/8 · Checking product catalogue, user hardware memory & local stores
                  </p>
                </div>
              ) : product || answer ? (
                <>
                  {/* Spoken User Utterance */}
                  {userQuery && (
                    <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-700">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        You said:
                      </span>
                      &ldquo;{userQuery}&rdquo;
                    </div>
                  )}

                  {/* Spoken Alexa+ Response */}
                  {answer && (
                    <div className="max-w-[95%] rounded-2xl rounded-tl-sm border border-cyan-200 bg-cyan-50/70 px-4 py-3.5 text-sm leading-relaxed text-slate-900 shadow-2xs">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-cyan-800 mb-1">
                        Alexa+ Response:
                      </span>
                      {answer}
                    </div>
                  )}

                  {/* Echo Show Visual Product & Store Card */}
                  {product && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            Identified Product
                          </p>
                          {confidence !== undefined && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-800">
                              {Math.round(confidence * 100)}% match
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-base font-bold text-slate-900">{product}</p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          Category: <span className="font-medium">{category || "General"}</span>
                          {storeName ? ` · Nearest Store: ${storeName}` : ""}
                        </p>
                      </div>
                      <span
                        className={`self-start sm:self-center shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyleFor(
                          evidenceStatus
                        )}`}
                      >
                        {statusFor(evidenceStatus)}
                      </span>
                    </div>
                  )}

                  {/* Audio Control Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      {answer && (
                        <button
                          type="button"
                          onClick={() => (isSpeaking ? stopSpeech() : speakText(answer))}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs sm:text-sm font-medium text-white transition hover:bg-slate-800"
                        >
                          {isSpeaking ? (
                            <>
                              <Square className="h-3.5 w-3.5 fill-current" />
                              Stop Voice
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-4 w-4" />
                              Hear Alexa Response
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      Powered by live MCP tools & Web Speech API
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-800">
                    No active conversation yet
                  </p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Click <strong>&ldquo;Speak to Alexa&rdquo;</strong> above to use your microphone, type a question, or tap one of the voice suggestions to watch Alexa+ resolve your request live over MCP.
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
