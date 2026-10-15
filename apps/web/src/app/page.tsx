"use client";

import React, { useState, useEffect } from "react";
import type { AgentResult, AgentState, TraceStep } from "@veylo/agent";
import type { GetPlaceDetailsOutput, GetDirectionsOutput } from "@veylo/types";
import { Header } from "@/components/Header";
import { SearchHero } from "@/components/SearchHero";
import { ClarificationCard } from "@/components/ClarificationCard";
import { IdentifiedProductCard } from "@/components/IdentifiedProductCard";
import { ComparisonMatrix } from "@/components/ComparisonMatrix";
import { LocalPlacesGrid } from "@/components/LocalPlacesGrid";
import { AgentTraceDrawer } from "@/components/AgentTraceDrawer";
import { ShoppingListDrawer, type ShoppingItem } from "@/components/ShoppingListDrawer";
import { StoreModal } from "@/components/StoreModal";
import { DirectionsModal } from "@/components/DirectionsModal";
import { AlexaSimulationModal } from "@/components/AlexaSimulationModal";
import type { AssistantMode } from "@/components/AssistantAvatar";
import { Sparkles, Square, Volume2, PackageCheck, RotateCcw } from "lucide-react";

export default function Home() {
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [liveTrace, setLiveTrace] = useState<TraceStep[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState("Austin, TX");

  // Drawers and Modals
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [isShoppingListOpen, setIsShoppingListOpen] = useState(false);
  const [isAlexaSimOpen, setIsAlexaSimOpen] = useState(false);

  const [selectedPlaceDetails, setSelectedPlaceDetails] = useState<GetPlaceDetailsOutput | null>(null);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);

  const [directions, setDirections] = useState<GetDirectionsOutput | null>(null);
  const [isDirectionsModalOpen, setIsDirectionsModalOpen] = useState(false);

  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [isAddingToList, setIsAddingToList] = useState(false);

  const [healthInfo, setHealthInfo] = useState<{
    ai?: { provider: string };
    mcp?: { mode: string; specVersion: string };
  }>({});

  const assistantMode: AssistantMode = isLoading
    ? "thinking"
    : isSpeaking
      ? "speaking"
      : isListening
        ? "listening"
        : "idle";

  // Fetch system health on mount
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealthInfo(data))
      .catch((err) => console.warn("Could not fetch health:", err));
  }, []);

  // Helper to execute agent with real-time SSE progressive trace streaming (Section 37.1)
  const executeAgentWithStream = async (
    payload: Record<string, unknown>,
    onStep: (step: TraceStep) => void
  ): Promise<AgentResult> => {
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ ...payload, stream: true }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Agent request failed (${res.status}): ${errorText}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      const data = await res.json();
      if (!data.ok || !data.result) {
        throw new Error(data.error || "Agent execution failed");
      }
      return data.result as AgentResult;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("No readable stream in response");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: AgentResult | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        if (!part.trim()) continue;
        const lines = part.split("\n");
        let event = "message";
        let dataStr = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            event = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            dataStr = line.slice(6);
          }
        }
        if (!dataStr) continue;
        try {
          const parsed = JSON.parse(dataStr);
          if (event === "step") {
            onStep(parsed as TraceStep);
          } else if (event === "done") {
            if (parsed.ok && parsed.result) {
              finalResult = parsed.result;
            } else if (parsed.error) {
              throw new Error(parsed.error);
            }
          } else if (event === "error") {
            throw new Error(parsed.error || "Agent execution failed");
          }
        } catch (parseErr) {
          if (parseErr instanceof Error && !parseErr.message.includes("Unexpected end of JSON")) {
            console.warn("Failed to parse SSE payload:", parseErr);
          }
        }
      }
    }

    if (!finalResult) {
      throw new Error("Stream closed before receiving agent completion result");
    }
    return finalResult;
  };

  // Run initial search
  const handleSearch = async (params: {
    message: string;
    location: string;
    urgency?: "today" | "this_week" | "online" | "unknown";
    compatibility?: string;
  }) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsListening(false);
    setIsLoading(true);
    setIsStreaming(true);
    setAgentResult(null);
    setAgentState(null);
    setLiveTrace([]);

    try {
      const result = await executeAgentWithStream(
        {
          message: params.message,
          location: params.location,
          urgency: params.urgency,
          compatibility: params.compatibility,
          userId: "default",
        },
        (step) => {
          setLiveTrace((prev) => [...prev, step]);
        }
      );

      setAgentResult(result);
      setAgentState(result.state);
      setLiveTrace(result.trace);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      alert(`Search error: ${e.message || "Failed to contact Veylo agent"}`);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleSpeakAnswer = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !agentResult?.answer) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(agentResult.answer);
    utterance.rate = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Answer a clarification question
  const handleAnswerClarification = async (answer: string) => {
    if (!agentState) return;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsLoading(true);
    setIsStreaming(true);

    try {
      const result = await executeAgentWithStream(
        {
          answer,
          state: agentState,
          userId: "default",
        },
        (step) => {
          setLiveTrace((prev) => [...prev, step]);
        }
      );

      setAgentResult(result);
      setAgentState(result.state);
      setLiveTrace(result.trace);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      alert(`Error replying: ${e.message}`);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  // Clear / Reset search back to fresh clean state
  const handleResetSearch = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsListening(false);
    setIsLoading(false);
    setIsStreaming(false);
    setAgentResult(null);
    setAgentState(null);
    setLiveTrace([]);
  };

  // Switch to alternative
  const handleSelectAlternative = (alt: string) => {
    handleAnswerClarification(`I prefer ${alt}`);
  };

  // Add product to shopping list via MCP tool call
  const handleAddToList = async (product: string) => {
    setIsAddingToList(true);
    try {
      const res = await fetch("/api/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "create_shopping_list",
          input: {
            items: [{ product, quantity: 1, notes: "Identified via Veylo" }],
          },
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setShoppingList((prev) => [
          ...prev,
          { product, quantity: 1, notes: "Identified via Veylo" },
        ]);
        setIsShoppingListOpen(true);
      } else {
        alert(`Could not add to shopping list: ${data.error}`);
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      alert(`Error calling shopping list tool: ${e.message}`);
    } finally {
      setIsAddingToList(false);
    }
  };

  // View store details
  const handleViewDetails = async (placeId: string) => {
    try {
      const res = await fetch("/api/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "get_place_details",
          input: { placeId },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSelectedPlaceDetails(data.result);
        setIsStoreModalOpen(true);
      } else {
        alert(`Could not fetch details: ${data.error}`);
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      alert(`Error fetching store details: ${e.message}`);
    }
  };

  // Get directions
  const handleGetDirections = async (placeId: string) => {
    try {
      const res = await fetch("/api/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "get_directions",
          input: { placeId, origin: currentLocation },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setDirections(data.result);
        setIsDirectionsModalOpen(true);
      } else {
        alert(`Could not get directions: ${data.error}`);
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      alert(`Error getting directions: ${e.message}`);
    }
  };

  // Contact store
  const handleContactStore = async (storeId: string) => {
    try {
      const res = await fetch("/api/tools/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "contact_store",
          input: { storeId },
        }),
      });
      const data = await res.json();
      if (data.ok && data.result) {
        if (data.result.phoneNumber) {
          window.open(`tel:${data.result.phoneNumber}`);
        } else {
          alert(`Contact information: ${data.result.message}`);
        }
      } else {
        alert(`Could not get contact info: ${data.error}`);
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      alert(`Error contacting store: ${e.message}`);
    }
  };

  const identified = agentResult?.state.identified;
  const comparison = agentResult?.state.comparison;
  const places = agentResult?.state.places;
  const checks = agentResult?.state.checks;
  const trace = isStreaming ? liveTrace : (agentResult?.trace ?? liveTrace);
  const stepsUsed = isStreaming ? liveTrace.length : (agentResult?.stepsUsed ?? liveTrace.length);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Top Header */}
      <Header
        traceCount={trace.length}
        shoppingListCount={shoppingList.length}
        onOpenTrace={() => setIsTraceOpen(true)}
        onOpenShoppingList={() => setIsShoppingListOpen(true)}
        onOpenAlexaSimulation={() => setIsAlexaSimOpen(true)}
        aiProvider={healthInfo?.ai?.provider || "rules"}
        mcpMode={healthInfo?.mcp?.mode || "streamable-http"}
        assistantMode={assistantMode}
      />

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        {/* Search Hero */}
        <SearchHero
          onSearch={handleSearch}
          isLoading={isLoading}
          currentLocation={currentLocation}
          onLocationChange={setCurrentLocation}
          assistantMode={assistantMode}
          onListeningChange={setIsListening}
        />

        {/* Progressive Agent Trace Stream: Live feed during search (Section 37.1) */}
        {isLoading && (
          <div className="my-5 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-xs animate-in fade-in duration-200 sm:my-6 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                <span className="font-semibold text-slate-900 text-sm">
                  Veylo Agent Progressive Trace (Live)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  Step {liveTrace.length}/8
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsTraceOpen(true)}
                  className="min-h-9 shrink-0 text-left text-xs font-medium text-blue-600 transition-colors hover:text-blue-800"
              >
                Inspect Full Log →
              </button>
            </div>

            {liveTrace.length === 0 ? (
              <div className="py-6 text-center flex flex-col items-center justify-center gap-2.5">
                <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
                <p className="text-xs font-medium text-slate-600">
                  Negotiating MCP tools & analyzing query intent...
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  Streaming execution steps via SSE from MCP server
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {liveTrace.map((step) => {
                  const isTool = step.kind === "tool";
                  const isAsk = step.kind === "ask";
                  const isStop = step.kind === "stop";

                  return (
                    <div
                      key={step.step}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs animate-in fade-in slide-in-from-bottom-2 duration-300"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                            {step.step}
                          </span>
                          {isTool && (
                            <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[11px]">
                              {step.tool}()
                            </span>
                          )}
                          {isAsk && (
                            <span className="font-mono font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                              ask_user()
                            </span>
                          )}
                          {isStop && (
                            <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                              stop_planner()
                            </span>
                          )}
                        </div>
                        {step.provider && (
                          <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {step.provider}
                          </span>
                        )}
                      </div>

                      <p className="text-slate-800 text-xs font-medium leading-relaxed pl-7">
                        {step.decision}
                      </p>

                      {(step.confidenceChange || (step.evidenceAdded !== undefined && step.evidenceAdded > 0)) && (
                        <div className="flex items-center gap-3 pl-7 mt-1.5 text-[11px] text-slate-500">
                          {step.confidenceChange && (
                            <span>
                              Confidence: {step.confidenceChange.from !== undefined ? `${Math.round(step.confidenceChange.from * 100)}% → ` : ""}
                              <strong className="text-slate-700">{Math.round(step.confidenceChange.to * 100)}%</strong>
                            </span>
                          )}
                          {step.evidenceAdded !== undefined && step.evidenceAdded > 0 && (
                            <span>
                              Evidence: <strong className="text-emerald-700">+{step.evidenceAdded}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Results Progression */}
        {agentResult && !isLoading && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Results Action Bar with Clear / New Search */}
            <div className="flex items-center justify-between gap-3 pb-1 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Search results verified via MCP (evidence-first)</span>
              </div>
              <button
                type="button"
                onClick={handleResetSearch}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-xs font-medium shadow-2xs transition-all active:scale-95"
                title="Reset dashboard and start a new search"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Clear / New Search</span>
              </button>
            </div>

            {/* 1. Clarification Card if agent needs input */}
            {agentResult.status === "needs_input" && agentResult.question && (
              <ClarificationCard
                question={agentResult.question}
                onAnswer={handleAnswerClarification}
                isLoading={isLoading}
              />
            )}

            {/* User Inventory Owned Item Warning (Section 37.2) */}
            {agentResult.state.ownedWarning && (
              <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 shadow-xs animate-in fade-in duration-200">
                <div className="p-2 bg-amber-100 rounded-xl border border-amber-300 text-amber-800 shrink-0 mt-0.5">
                  <PackageCheck className="w-5 h-5 text-amber-700" />
                </div>
                <div className="flex-1 text-xs sm:text-sm">
                  <div className="font-semibold text-amber-950 mb-0.5 flex items-center gap-2">
                    <span>Hardware & Inventory Memory</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-200/80 text-amber-900 font-bold">
                      Redundant Purchase Prevented
                    </span>
                  </div>
                  <p className="font-medium text-amber-900 leading-relaxed">
                    {agentResult.state.ownedWarning}
                  </p>
                </div>
              </div>
            )}

            {/* 2. Plain Language Answer Banner */}
            {agentResult.answer && (
              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-start gap-3">
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      What I found
                    </span>
                    <button
                      type="button"
                      onClick={handleSpeakAnswer}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
                    >
                      {isSpeaking ? <Square className="h-3 w-3 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
                      {isSpeaking ? "Stop" : "Hear answer"}
                    </button>
                  </div>
                  <p className="text-sm sm:text-base font-medium text-slate-900 leading-relaxed">
                    {agentResult.answer}
                  </p>
                </div>
              </div>
            )}

            {/* 3. Inferred Product Card */}
            {identified && (
              <IdentifiedProductCard
                identified={identified}
                onSelectAlternative={handleSelectAlternative}
                onAddToList={handleAddToList}
                isAddingToList={isAddingToList}
              />
            )}

            {/* 4. Comparison Matrix */}
            {comparison && (
              <ComparisonMatrix comparison={comparison} />
            )}

            {/* 5. Local Stores Grid */}
            {places && places.length > 0 && (
              <LocalPlacesGrid
                places={places}
                checks={checks}
                bestPlaceId={agentResult.best?.placeId}
                onViewDetails={handleViewDetails}
                onGetDirections={handleGetDirections}
                onContactStore={handleContactStore}
              />
            )}
          </div>
        )}
      </main>

      {/* Drawers & Modals */}
      <AgentTraceDrawer
        isOpen={isTraceOpen}
        onClose={() => setIsTraceOpen(false)}
        trace={trace}
        stepsUsed={stepsUsed}
        isStreaming={isStreaming}
      />

      <ShoppingListDrawer
        isOpen={isShoppingListOpen}
        onClose={() => setIsShoppingListOpen(false)}
        items={shoppingList}
        onRemoveItem={(idx) => setShoppingList((prev) => prev.filter((_, i) => i !== idx))}
        onClearList={() => setShoppingList([])}
      />

      <StoreModal
        isOpen={isStoreModalOpen}
        onClose={() => setIsStoreModalOpen(false)}
        details={selectedPlaceDetails}
        check={selectedPlaceDetails ? checks?.[selectedPlaceDetails.id] : undefined}
        onGetDirections={() => {
          if (selectedPlaceDetails) {
            handleGetDirections(selectedPlaceDetails.id);
          }
        }}
      />

      <DirectionsModal
        isOpen={isDirectionsModalOpen}
        onClose={() => setIsDirectionsModalOpen(false)}
        directions={directions}
      />

      <AlexaSimulationModal
        isOpen={isAlexaSimOpen}
        onClose={() => setIsAlexaSimOpen(false)}
        product={identified?.product}
        category={identified?.category}
        storeName={agentResult?.best?.name || places?.[0]?.name}
        evidenceStatus={agentResult?.best?.status || places?.[0]?.inventoryStatus}
      />

      {/* Minimal Clean Footer */}
      <footer className="border-t border-slate-200 bg-white/60 py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">Veylo</span>
            <span>•</span>
            <span>Amazon Developer Hackathon (Alexa+ Track & AWS Builder Mini Challenge)</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>MCP Spec 2025-11-25</span>
            <span>•</span>
            <span>OpenStreetMap Geodata</span>
            <span>•</span>
            <span>Evidence-First Inventory Trust</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

