"use client";

import React from "react";
import { Sparkles, Terminal, ShoppingBag, Radio, ShieldCheck, Cpu } from "lucide-react";

interface HeaderProps {
  traceCount: number;
  shoppingListCount: number;
  onOpenTrace: () => void;
  onOpenShoppingList: () => void;
  onOpenAlexaSimulation: () => void;
  aiProvider?: string;
  mcpMode?: string;
}

export function Header({
  traceCount,
  shoppingListCount,
  onOpenTrace,
  onOpenShoppingList,
  onOpenAlexaSimulation,
  aiProvider = "rules",
  mcpMode = "streamable-http",
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold tracking-tight text-lg shadow-sm">
            V
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 tracking-tight text-lg">Veylo</span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                Alexa+ Track
              </span>
              <span className="hidden md:inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                AWS Builder
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">See it. Say it. Find it.</p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="hidden lg:flex items-center gap-2">
          {/* MCP Status */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-xs"
            title={`MCP Transport: ${mcpMode}`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span className="font-medium">MCP 2025-11-25</span>
            <span className="text-[10px] text-slate-400 font-mono">Streamable HTTP</span>
          </div>

          {/* AI Provider */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border ${
              aiProvider === "bedrock"
                ? "bg-purple-50/80 border-purple-200 text-purple-900"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
            title={
              aiProvider === "bedrock"
                ? "Amazon Bedrock (Claude 3.5 Sonnet / AWS Builder Mini Challenge)"
                : `AI Provider: ${aiProvider}`
            }
          >
            <Cpu className={`w-3.5 h-3.5 ${aiProvider === "bedrock" ? "text-purple-600" : "text-blue-600"}`} />
            <span className="font-medium">AI:</span>
            <span className="font-mono uppercase text-[11px] font-semibold">
              {aiProvider === "bedrock" ? "BEDROCK" : aiProvider}
            </span>
            {aiProvider === "bedrock" && (
              <span className="text-[10px] text-purple-700 font-mono hidden xl:inline">Claude 3.5</span>
            )}
          </div>

          {/* Evidence Trust */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50/60 border border-emerald-200/80 text-emerald-800 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-medium">Zero Hallucinated Stock</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Alexa+ Simulation Trigger */}
          <button
            onClick={onOpenAlexaSimulation}
            aria-label="Open Alexa+ preview"
            className="flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 sm:px-3"
            title="Preview how an Alexa+ agent invokes Veylo"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Alexa+ Preview</span>
          </button>

          {/* Shopping List Trigger */}
          <button
            onClick={onOpenShoppingList}
            aria-label={`Open shopping list${shoppingListCount > 0 ? `, ${shoppingListCount} items` : ""}`}
            className="relative flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 sm:px-3"
            title="View saved shopping list"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">List</span>
            {shoppingListCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-900 text-white">
                {shoppingListCount}
              </span>
            )}
          </button>

          {/* Agent Trace Drawer Trigger */}
          <button
            onClick={onOpenTrace}
            aria-label={`Open agent trace${traceCount > 0 ? `, ${traceCount} steps` : ""}`}
            className="flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-slate-800 sm:px-3"
            title="Inspect bounded agent planner reasoning trace"
          >
            <Terminal className="w-3.5 h-3.5 text-slate-300" />
            <span className="hidden sm:inline">Agent Trace</span>
            {traceCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500 text-white">
                {traceCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

