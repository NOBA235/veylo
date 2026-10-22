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
import { AssistantAvatar, type AssistantMode } from "@/components/AssistantAvatar";
import { speakAssistantText, stopAssistantSpeech } from "@/lib/speech";
import { Square, Volume2, PackageCheck, RotateCcw } from "lucide-react";

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

  // Helper to execute agent with real-time SSE progressive trace streaming
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
    stopAssistantSpeech();
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
    if (!agentResult?.answer) return;
    if (isSpeaking) {
      stopAssistantSpeech();
      setIsSpeaking(false);
      return;
    }

    void speakAssistantText(agentResult.answer, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  // Answer a clarification question
  const handleAnswerClarification = async (answer: string) => {
    if (!agentState) return;
    stopAssistantSpeech();
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

  // Reset search back to fresh state
  const handleResetSearch = () => {
    stopAssistantSpeech();
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
  const latestStep = liveTrace[liveTrace.length - 1];

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Top Header */}
      <Header
        traceCount={trace.length}
        shoppingListCount={shoppingList.length}
        onOpenTrace={() => setIsTraceOpen(true)}
        onOpenShoppingList={() => setIsShoppingListOpen(true)}
        onOpenAlexaSimulation={() => {
          // The modal auto-speaks the current answer. Stop any page-level playback first.
          stopAssistantSpeech();
          setIsSpeaking(false);
          setIsAlexaSimOpen(true);
        }}
        aiProvider={healthInfo?.ai?.provider || "rules"}
        mcpMode={healthInfo?.mcp?.mode || "streamable-http"}
        assistantMode={assistantMode}
      />

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Search Hero */}
        <SearchHero
          onSearch={handleSearch}
          isLoading={isLoading}
          currentLocation={currentLocation}
          onLocationChange={setCurrentLocation}
          assistantMode={assistantMode}
          onListeningChange={setIsListening}
        />

        {/* Calm Progressive Status Feed during Search */}
        {isLoading && (
          <div className="my-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <AssistantAvatar mode="thinking" size="sm" animationOnly />
                <span className="font-medium text-zinc-900 truncate">
                  {latestStep?.decision || "Analyzing query and querying store directory..."}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[11px] text-zinc-500">
                  Step {liveTrace.length}/8
                </span>
                <button
                  type="button"
                  onClick={() => setIsTraceOpen(true)}
                  className="text-zinc-600 hover:text-zinc-900 font-medium underline-offset-2 hover:underline"
                >
                  View trace
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results Progression */}
        {agentResult && !isLoading && (
          <div className="mt-8 space-y-6 animate-in fade-in duration-200">
            {/* Action Bar with Query Feedback & Reset Button */}
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-zinc-200 text-xs">
              <div className="flex items-center gap-2 text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Verified results for Austin, TX</span>
              </div>
              <button
                type="button"
                onClick={handleResetSearch}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
                title="Start a new search"
              >
                <RotateCcw className="h-3 w-3 text-zinc-400" />
                <span>New search</span>
              </button>
            </div>

            {/* 1. Clarification Card (First if agent needs user reply) */}
            {agentResult.status === "needs_input" && agentResult.question && (
              <ClarificationCard
                question={agentResult.question}
                onAnswer={handleAnswerClarification}
                isLoading={isLoading}
              />
            )}

            {/* User Owned Hardware Memory Notice */}
            {agentResult.state.ownedWarning && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-800 shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 rounded-md bg-zinc-200 p-1 text-zinc-700">
                    <PackageCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-zinc-900 mb-0.5">
                      Hardware memory notice
                    </div>
                    <p className="text-zinc-600 leading-relaxed">
                      {agentResult.state.ownedWarning}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Plain Language Assistant Answer */}
            {agentResult.answer && (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-xs">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Summary
                  </span>
                  <button
                    type="button"
                    onClick={handleSpeakAnswer}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
                  >
                    {isSpeaking ? (
                      <>
                        <Square className="h-3 w-3 fill-current text-zinc-700" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5 text-zinc-500" />
                        <span>Listen</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm sm:text-base font-medium text-zinc-900 leading-relaxed">
                  {agentResult.answer}
                </p>
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
        answer={agentResult?.answer}
        userQuery={agentResult?.state.description}
        confidence={identified?.confidence}
        traceCount={trace.length}
        isLoading={isLoading}
        currentLocation={currentLocation}
        onAskAlexa={(promptText) =>
          handleSearch({
            message: promptText,
            location: currentLocation,
            urgency: "today",
          })
        }
      />

      {/* Restrained Calm Footer */}
      <footer className="mt-16 border-t border-zinc-200/80 bg-white py-6 text-xs text-zinc-500">
        <div className="mx-auto flex max-w-4xl flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-6 lg:px-8 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-800">Veylo</span>
            <span className="text-zinc-300">•</span>
            <span>See it. Say it. Find it.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-2 gap-y-1 text-[11px] text-zinc-400">
            <span>Evidence-first inventory</span>
            <span>•</span>
            <span>OpenStreetMap</span>
            <span>•</span>
            <span>MCP Streamable HTTP</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
