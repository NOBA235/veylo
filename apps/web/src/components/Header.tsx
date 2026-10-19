"use client";

import React from "react";
import { Sparkles, Terminal, ShoppingBag } from "lucide-react";
import { AssistantAvatar, type AssistantMode } from "@/components/AssistantAvatar";

interface HeaderProps {
  traceCount: number;
  shoppingListCount: number;
  onOpenTrace: () => void;
  onOpenShoppingList: () => void;
  onOpenAlexaSimulation: () => void;
  aiProvider?: string;
  mcpMode?: string;
  assistantMode?: AssistantMode;
}

export function Header({
  traceCount,
  shoppingListCount,
  onOpenTrace,
  onOpenShoppingList,
  onOpenAlexaSimulation,
  assistantMode = "idle",
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-3 sm:px-6 lg:px-8">
        {/* Brand & Identity */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <AssistantAvatar mode={assistantMode} nav animationOnly />
            <span className="text-sm font-semibold tracking-tight text-zinc-900">
              Veylo
            </span>
          </div>
          <span className="hidden text-zinc-300 sm:inline">/</span>
          <span className="hidden text-xs text-zinc-500 font-normal sm:inline truncate">
            See it. Say it. Find it.
          </span>
        </div>

        {/* Quiet Product Actions */}
        <nav className="flex items-center gap-1 shrink-0" aria-label="Main Navigation">
          {/* Alexa+ Preview Trigger */}
          <button
            type="button"
            onClick={onOpenAlexaSimulation}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 sm:px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            title="Preview Alexa+ voice and multimodal simulation"
            aria-label="Alexa+ Preview"
          >
            <Sparkles className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="hidden sm:inline">Alexa+</span>
          </button>

          {/* Shopping List Trigger */}
          <button
            type="button"
            onClick={onOpenShoppingList}
            aria-label={`Shopping list${shoppingListCount > 0 ? `, ${shoppingListCount} items` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 sm:px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            title="View saved shopping list"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="hidden sm:inline">List</span>
            {shoppingListCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-1.5 py-0.2 text-[10px] font-semibold text-white">
                {shoppingListCount}
              </span>
            )}
          </button>

          {/* Agent Trace Drawer Trigger */}
          <button
            type="button"
            onClick={onOpenTrace}
            aria-label={`Agent execution trace${traceCount > 0 ? `, ${traceCount} steps` : ""}`}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 sm:px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            title="Inspect agent planner execution and diagnostics"
          >
            <Terminal className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="hidden sm:inline">Trace</span>
            {traceCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-zinc-200 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-800">
                {traceCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}