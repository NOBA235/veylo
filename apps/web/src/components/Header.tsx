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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold tracking-tight text-lg shadow-sm">
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
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-xs">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-medium">AI:</span>
            <span className="text-slate-900 font-mono uppercase text-[11px]">{aiProvider}</span>
          </div>

          {/* Evidence Trust */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50/60 border border-emerald-200/80 text-emerald-800 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-medium">Zero Hallucinated Stock</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Alexa+ Simulation Trigger */}
          <button
            onClick={onOpenAlexaSimulation}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
            title="Preview how an Alexa+ agent invokes Veylo"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Alexa+ Preview</span>
          </button>

          {/* Shopping List Trigger */}
          <button
            onClick={onOpenShoppingList}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 relative"
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-900 bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
            title="Inspect bounded agent planner reasoning trace"
          >
            <Terminal className="w-3.5 h-3.5 text-slate-300" />
            <span>Agent Trace</span>
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

