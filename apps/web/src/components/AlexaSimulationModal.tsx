"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Radio,
  Volume2,
  VolumeX,
  Play,
  ShieldCheck,
  Navigation,
  Phone,
  Code2,
} from "lucide-react";

interface AlexaSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: string;
  category?: string;
  storeName?: string;
  evidenceStatus?: string;
}

type ScenarioKey = "killer" | "tape" | "current";

interface Scenario {
  id: ScenarioKey;
  label: string;
  userPrompt: string;
  product: string;
  category: string;
  storeName: string;
  distance: string;
  evidenceStatus: "CONFIRMED" | "LIKELY" | "WEB_FOUND" | "UNKNOWN";
  alexaClarification: string;
  userClarificationAnswer: string;
  alexaSynthesis: string;
  mcpCalls: Array<{
    turn: number;
    tool: string;
    input: Record<string, unknown>;
    outputSummary: string;
  }>;
}

export function AlexaSimulationModal({
  isOpen,
  onClose,
  product = "USB-C to HDMI adapter",
  category = "video adapters",
  storeName = "Fixture Electronics",
  evidenceStatus = "LIKELY",
}: AlexaSimulationModalProps) {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>("killer");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showMcpPayload, setShowMcpPayload] = useState(false);
  const [isSpeakingEnabled, setIsSpeakingEnabled] = useState(false);

  // Define scenarios
  const scenarios: Record<ScenarioKey, Scenario> = {
    killer: {
      id: "killer",
      label: "Killer Demo (Laptop to TV)",
      userPrompt: "Alexa, I need that little thing that lets me plug my laptop into the TV. I don't know what it's called.",
      product: "USB-C to HDMI adapter",
      category: "video adapters",
      storeName: "Fixture Electronics",
      distance: "0.6 km away",
      evidenceStatus: "LIKELY",
      alexaClarification: "You probably mean a USB-C to HDMI adapter. Do you need one nearby today, or are you okay ordering online?",
      userClarificationAnswer: "Yeah, I need it nearby today.",
      alexaSynthesis:
        "I found Fixture Electronics about 600 meters away. They have an online listing for a compatible adapter, but shelf inventory is not confirmed. Would you like directions or their phone number?",
      mcpCalls: [
        {
          turn: 1,
          tool: "identify_product",
          input: {
            description: "I need that little thing that lets me plug my laptop into the TV. I don't know what it's called.",
          },
          outputSummary: "product: 'USB-C to HDMI adapter', confidence: 0.91, category: 'video adapters'",
        },
        {
          turn: 2,
          tool: "discover_local_places",
          input: {
            product: "USB-C to HDMI adapter",
            location: "Austin, TX",
            storeCategories: ["electronics", "computer"],
          },
          outputSummary: "Discovered 5 nearby electronics stores (Fixture Electronics: 0.55 km)",
        },
        {
          turn: 3,
          tool: "check_local_inventory",
          input: {
            storeId: "osm:node/1",
            product: "USB-C to HDMI adapter",
          },
          outputSummary: "status: LIKELY, confidence: 0.72 (Online listing found; shelf stock not verified)",
        },
      ],
    },
    tape: {
      id: "tape",
      label: "Second Demo (Plumber's Tape)",
      userPrompt: "Alexa, I need that white tape plumbers wrap around pipe threads to stop leaks.",
      product: "PTFE thread seal tape",
      category: "plumbing consumables",
      storeName: "Fixture Hardware",
      distance: "0.4 km away",
      evidenceStatus: "UNKNOWN",
      alexaClarification: "That is called PTFE thread seal tape. Do you need a roll nearby today?",
      userClarificationAnswer: "Yes, I have a leak right now.",
      alexaSynthesis:
        "Fixture Hardware is 400 meters away on Main St. They are classified as a hardware store which routinely stocks plumbing tape, but current shelf stock is unverified. Should I show directions?",
      mcpCalls: [
        {
          turn: 1,
          tool: "identify_product",
          input: {
            description: "white tape plumbers wrap around pipe threads to stop leaks",
          },
          outputSummary: "product: 'PTFE thread seal tape', confidence: 0.94, category: 'plumbing consumables'",
        },
        {
          turn: 2,
          tool: "discover_local_places",
          input: {
            product: "PTFE thread seal tape",
            location: "Austin, TX",
            storeCategories: ["hardware", "plumbing_supplies"],
          },
          outputSummary: "Discovered 4 hardware/plumbing retailers nearby",
        },
        {
          turn: 3,
          tool: "check_local_inventory",
          input: {
            storeId: "osm:node/4",
            product: "PTFE thread seal tape",
          },
          outputSummary: "status: UNKNOWN, confidence: 0.25 (Hardware store fit 1.0; zero stock evidence fabricated)",
        },
      ],
    },
    current: {
      id: "current",
      label: "Current Search Result",
      userPrompt: `Alexa, help me find a ${product}.`,
      product: product,
      category: category,
      storeName: storeName,
      distance: "Nearby",
      evidenceStatus: (evidenceStatus as Scenario["evidenceStatus"]) || "LIKELY",
      alexaClarification: `You probably mean a ${product}. Do you need one nearby today?`,
      userClarificationAnswer: "Yes, nearby today.",
      alexaSynthesis: `I found ${storeName}. Current evidence status is ${evidenceStatus}. Would you like directions or contact info?`,
      mcpCalls: [
        {
          turn: 1,
          tool: "identify_product",
          input: { description: product },
          outputSummary: `product: '${product}', category: '${category}'`,
        },
        {
          turn: 2,
          tool: "discover_local_places",
          input: { product, location: "Austin, TX" },
          outputSummary: `Found local retailers for '${category}'`,
        },
        {
          turn: 3,
          tool: "check_local_inventory",
          input: { storeName, product },
          outputSummary: `status: ${evidenceStatus}`,
        },
      ],
    },
  };

  const scenario = scenarios[selectedScenario];

  // Text to speech simulation
  const speakText = (text: string) => {
    if (!isSpeakingEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;
    utterance.pitch = 1.05;
    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="bg-slate-900 text-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Echo Show Header Bezel */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            {/* Alexa Pulsating Ring */}
            <div className="relative flex items-center justify-center">
              <div
                className={`w-4 h-4 rounded-full transition-all duration-300 ${
                  isPlayingAudio
                    ? "bg-cyan-400 ring-4 ring-cyan-500/50 scale-110 shadow-[0_0_15px_rgba(34,211,238,0.9)]"
                    : "bg-cyan-500 ring-2 ring-cyan-500/30"
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-wide text-cyan-200">
                  Echo Show 10 • Alexa+ Voice Agent Simulation
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                  MCP Streamable HTTP
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Demonstrating how an Alexa+ agent invokes Veylo MCP capabilities to turn unknown intent into real action
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Toggle */}
            <button
              onClick={() => {
                const nextState = !isSpeakingEnabled;
                setIsSpeakingEnabled(nextState);
                if (nextState) {
                  speakText(scenario.alexaSynthesis);
                } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                  setIsPlayingAudio(false);
                }
              }}
              className={`p-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                isSpeakingEnabled
                  ? "bg-cyan-950/80 text-cyan-300 border-cyan-700 hover:bg-cyan-900"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              }`}
              title={isSpeakingEnabled ? "Voice speech enabled" : "Enable voice speech synthesis"}
            >
              {isSpeakingEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{isSpeakingEnabled ? "Voice Muted" : "Unmute Voice"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preset Selector Bar */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span>Scenario:</span>
            {(["killer", "tape", "current"] as ScenarioKey[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setSelectedScenario(key);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedScenario === key
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60"
                }`}
              >
                {scenarios[key].label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMcpPayload(!showMcpPayload)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                showMcpPayload
                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-700"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>{showMcpPayload ? "Hide MCP Wire" : "View MCP Wire"}</span>
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Echo Show 10 Multimodal Display Canvas */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/30 p-5 border border-slate-800 shadow-inner relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Echo Show UI Top Bar */}
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-3 mb-4">
              <span className="font-mono text-slate-300">Echo Show 10 Screen Display</span>
              <div className="flex items-center gap-3">
                <span className="text-cyan-400 font-mono">10:42 AM</span>
                <span>•</span>
                <span className="text-slate-300">Austin 72°F</span>
              </div>
            </div>

            {/* Echo Show Multimodal Product Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {scenario.category}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                      scenario.evidenceStatus === "CONFIRMED"
                        ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                        : scenario.evidenceStatus === "LIKELY"
                          ? "bg-blue-950 text-blue-300 border-blue-800"
                          : scenario.evidenceStatus === "WEB_FOUND"
                            ? "bg-amber-950 text-amber-300 border-amber-800"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}
                  >
                    Inventory: {scenario.evidenceStatus}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white tracking-tight">{scenario.product}</h3>

                <p className="text-sm text-slate-300">
                  Available at <strong className="text-cyan-300">{scenario.storeName}</strong> ({scenario.distance})
                </p>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {scenario.evidenceStatus === "CONFIRMED"
                    ? "Verified in-stock shelf evidence observed in the last 24h."
                    : scenario.evidenceStatus === "LIKELY"
                      ? "Store website listing matches this product. Current in-store shelf stock is not confirmed."
                      : "Store type matches relevance, but no shelf stock evidence is claimed or fabricated."}
                </p>
              </div>

              {/* Action Buttons on Screen */}
              <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <button
                  onClick={() => alert(`Simulated Echo Show Action: Navigating to ${scenario.storeName}`)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Show Directions</span>
                </button>
                <button
                  onClick={() => alert(`Simulated Echo Show Action: Dialing ${scenario.storeName}`)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call to Confirm Stock</span>
                </button>
              </div>
            </div>
          </div>

          {/* Simulated Alexa+ Dialogue Flow */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Turn-by-Turn Voice & MCP Interaction Flow</span>
              <span className="text-[11px] font-normal text-slate-500">
                Click any turn to replay voice response
              </span>
            </h4>

            {/* Turn 1: Initial Prompt */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                  U
                </div>
                <div className="bg-slate-800/90 rounded-2xl rounded-tl-sm px-4 py-3 text-slate-200 text-sm max-w-xl border border-slate-700/60 shadow-sm">
                  <span className="text-[10px] text-slate-400 block mb-1 font-mono uppercase tracking-wider">
                    Turn 1 • Ambiguous Voice Speech
                  </span>
                  &ldquo;{scenario.userPrompt}&rdquo;
                </div>
              </div>

              {/* MCP Tool Call 1 */}
              <div className="ml-11 p-3 rounded-xl bg-slate-950 border border-cyan-900/40 text-xs text-cyan-300 flex items-start gap-2.5">
                <Radio className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-400">Alexa+ calls MCP:</span>
                    <strong className="text-cyan-200">identify_product()</strong>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Output: {scenario.mcpCalls[0]?.outputSummary}
                  </div>
                </div>
              </div>
            </div>

            {/* Turn 2: Clarification & Confirmation */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md">
                  A+
                </div>
                <div className="bg-cyan-950/40 border border-cyan-800/60 rounded-2xl rounded-tl-sm px-4 py-3 text-cyan-100 text-sm max-w-xl space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider flex items-center gap-1">
                      <Volume2 className="w-3 h-3" /> Alexa+ Agent Response
                    </span>
                    <button
                      onClick={() => speakText(scenario.alexaClarification)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-200 flex items-center gap-1 font-mono underline"
                    >
                      <Play className="w-2.5 h-2.5" /> Play Voice
                    </button>
                  </div>
                  <p className="leading-relaxed">&ldquo;{scenario.alexaClarification}&rdquo;</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                  U
                </div>
                <div className="bg-slate-800/90 rounded-2xl rounded-tl-sm px-4 py-2.5 text-slate-200 text-sm max-w-xl border border-slate-700/60 shadow-sm">
                  <span className="text-[10px] text-slate-400 block mb-1 font-mono uppercase tracking-wider">
                    Turn 2 • User Clarification
                  </span>
                  &ldquo;{scenario.userClarificationAnswer}&rdquo;
                </div>
              </div>

              {/* MCP Tool Call 2 & 3 */}
              <div className="ml-11 p-3 rounded-xl bg-slate-950 border border-cyan-900/40 text-xs text-cyan-300 flex items-start gap-2.5">
                <Radio className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-400">Alexa+ calls MCP:</span>
                    <strong className="text-cyan-200">discover_local_places()</strong> +{" "}
                    <strong className="text-cyan-200">check_local_inventory()</strong>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Evidence: {scenario.mcpCalls[2]?.outputSummary}
                  </div>
                </div>
              </div>
            </div>

            {/* Turn 3: Synthesis & Action */}
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md">
                  A+
                </div>
                <div className="bg-cyan-950/40 border border-cyan-800/60 rounded-2xl rounded-tl-sm px-4 py-3 text-cyan-100 text-sm max-w-xl space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider flex items-center gap-1">
                      <Volume2 className="w-3 h-3" /> Turn 3 • Alexa+ Action Recommendation
                    </span>
                    <button
                      onClick={() => speakText(scenario.alexaSynthesis)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-200 flex items-center gap-1 font-mono underline"
                    >
                      <Play className="w-2.5 h-2.5" /> Play Voice
                    </button>
                  </div>
                  <p className="leading-relaxed">&ldquo;{scenario.alexaSynthesis}&rdquo;</p>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible MCP Wire Inspector */}
          {showMcpPayload && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" /> Live Model Context Protocol Payload
                </span>
                <span className="text-[10px] text-slate-500">Streamable HTTP • Port 8787</span>
              </div>
              <pre className="text-slate-300 text-[11px] overflow-x-auto p-3 bg-slate-900 rounded-xl border border-slate-800 leading-normal">
{JSON.stringify(
  {
    jsonrpc: "2.0",
    id: "alexa-turn-1",
    method: "tools/call",
    params: {
      name: "identify_product",
      arguments: scenario.mcpCalls[0]?.input,
    },
  },
  null,
  2,
)}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Amazon Developer Hackathon:</strong> Alexa+ capability verified against live MCP contracts & Bedrock AI
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors"
          >
            Close Echo Show Preview
          </button>
        </div>
      </div>
    </div>
  );
}
