"use client";

import React, { useState, useEffect } from "react";
import type { AgentResult, AgentState } from "@veylo/agent";
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
import { Sparkles } from "lucide-react";

export default function Home() {
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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

  // Fetch system health on mount
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealthInfo(data))
      .catch((err) => console.warn("Could not fetch health:", err));
  }, []);

  // Run initial search
  const handleSearch = async (params: {
    message: string;
    location: string;
    urgency?: "today" | "this_week" | "online" | "unknown";
    compatibility?: string;
  }) => {
    setIsLoading(true);
    setAgentResult(null);
    setAgentState(null);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: params.message,
          location: params.location,
          urgency: params.urgency,
          compatibility: params.compatibility,
        }),
      });

      const data = await res.json();
      if (data.ok && data.result) {
        setAgentResult(data.result);
        setAgentState(data.result.state);
      } else {
        alert(`Search error: ${data.error || "Unknown error"}`);
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      alert(`Network error: ${e.message || "Failed to contact Veylo agent"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Answer a clarification question
  const handleAnswerClarification = async (answer: string) => {
    if (!agentState) return;
    setIsLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer,
          state: agentState,
        }),
      });

      const data = await res.json();
      if (data.ok && data.result) {
        setAgentResult(data.result);
        setAgentState(data.result.state);
      } else {
        alert(`Error replying: ${data.error || "Unknown error"}`);
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      alert(`Network error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
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
  const trace = agentResult?.trace ?? [];
  const stepsUsed = agentResult?.stepsUsed ?? 0;

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
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Search Hero */}
        <SearchHero
          onSearch={handleSearch}
          isLoading={isLoading}
          currentLocation={currentLocation}
          onLocationChange={setCurrentLocation}
        />

        {/* Loading Spinner */}
        {isLoading && (
          <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-700">
              Agent analyzing intent, checking local OpenStreetMap places, and synthesizing evidence...
            </p>
            <p className="text-xs text-slate-400 font-mono">
              Evaluating bounded planner loop (max 8 steps) over MCP
            </p>
          </div>
        )}

        {/* Results Progression */}
        {agentResult && !isLoading && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 1. Clarification Card if agent needs input */}
            {agentResult.status === "needs_input" && agentResult.question && (
              <ClarificationCard
                question={agentResult.question}
                onAnswer={handleAnswerClarification}
                isLoading={isLoading}
              />
            )}

            {/* 2. Plain Language Answer Banner */}
            {agentResult.answer && (
              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-start gap-3">
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Agent Finding & Synthesis
                  </span>
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

