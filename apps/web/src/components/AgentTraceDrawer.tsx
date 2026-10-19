"use client";

import React from "react";
import type { TraceStep } from "@veylo/agent";
import { X, Terminal, ShieldCheck } from "lucide-react";

interface AgentTraceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  trace: TraceStep[];
  stepsUsed: number;
  maxSteps?: number;
  isStreaming?: boolean;
}

export function AgentTraceDrawer({
  isOpen,
  onClose,
  trace,
  stepsUsed,
  maxSteps = 8,
  isStreaming = false,
}: AgentTraceDrawerProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Agent Execution Trace"
    >
      <div className="flex h-full w-full max-w-xl flex-col border-l border-zinc-200 bg-white shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Agent Execution Trace
                </h3>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-600">
                  {stepsUsed}/{maxSteps} steps
                </span>
                {isStreaming && (
                  <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-quiet-pulse" />
                    Live
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                Inspectable, evidence-first execution log
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close trace drawer"
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Secondary Diagnostics Section (Demoted from main header) */}
        <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 sm:px-6 text-[11px] text-zinc-500 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span>MCP 2025-11-25 (Streamable HTTP)</span>
            <span>•</span>
            <span>Evidence-first inventory</span>
          </div>
          <span className="font-mono text-zinc-400">Bounded planner</span>
        </div>

        {/* Steps Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
          {trace.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-400">
              {isStreaming ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="h-5 w-5 rounded-full border-2 border-zinc-200 border-t-zinc-800 animate-quiet-spin" />
                  <span>Negotiating MCP tools & initiating agent trace...</span>
                </div>
              ) : (
                "No planner steps executed yet. Submit a search to view tool calls."
              )}
            </div>
          ) : (
            trace.map((step) => {
              const isTool = step.kind === "tool";
              const isAsk = step.kind === "ask";
              const isStop = step.kind === "stop";

              return (
                <div
                  key={step.step}
                  className="rounded-lg border border-zinc-200 bg-white p-3.5 text-xs shadow-2xs transition-colors"
                >
                  {/* Step Title Bar */}
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded bg-zinc-900 text-[10px] font-mono text-white">
                        {step.step}
                      </span>
                      {isTool && (
                        <span className="font-mono text-[11px] font-semibold text-blue-700">
                          {step.tool}()
                        </span>
                      )}
                      {isAsk && (
                        <span className="font-mono text-[11px] font-semibold text-amber-700">
                          ask_user()
                        </span>
                      )}
                      {isStop && (
                        <span className="font-mono text-[11px] font-semibold text-emerald-700">
                          stop_planner()
                        </span>
                      )}
                    </div>

                    {step.provider && (
                      <span className="font-mono text-[10px] text-zinc-500 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200">
                        {step.provider}
                      </span>
                    )}
                  </div>

                  {/* Decision Text */}
                  <p className="text-zinc-800 leading-relaxed font-medium mb-2">
                    {step.decision}
                  </p>

                  {/* Input / Output Snippets */}
                  {step.inputSummary && (
                    <div className="mb-1.5">
                      <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-0.5">
                        Tool input
                      </span>
                      <pre className="font-mono text-[11px] text-zinc-700 bg-zinc-50 p-2 rounded border border-zinc-200/80 overflow-x-auto whitespace-pre-wrap break-all">
                        {step.inputSummary}
                      </pre>
                    </div>
                  )}

                  {step.outputSummary && (
                    <div className="mb-1.5">
                      <span className="text-[10px] uppercase font-semibold text-zinc-400 block mb-0.5">
                        Tool output
                      </span>
                      <pre className="font-mono text-[11px] text-zinc-700 bg-zinc-50 p-2 rounded border border-zinc-200/80 overflow-x-auto whitespace-pre-wrap break-all">
                        {step.outputSummary}
                      </pre>
                    </div>
                  )}

                  {/* Confidence / Evidence metrics */}
                  {(step.confidenceChange ||
                    (step.evidenceAdded !== undefined && step.evidenceAdded > 0)) && (
                    <div className="flex items-center gap-3 pt-2 mt-2 border-t border-zinc-100 text-[11px] text-zinc-500">
                      {step.confidenceChange && (
                        <span>
                          Confidence:{" "}
                          <strong className="text-zinc-800">
                            {Math.round(step.confidenceChange.to * 100)}%
                          </strong>
                        </span>
                      )}
                      {step.evidenceAdded !== undefined && step.evidenceAdded > 0 && (
                        <span>
                          Evidence:{" "}
                          <strong className="text-emerald-700">
                            +{step.evidenceAdded}
                          </strong>
                        </span>
                      )}
                    </div>
                  )}

                  {step.error && (
                    <div className="mt-2 rounded bg-rose-50 border border-rose-200 p-2 text-rose-800 text-xs">
                      Error [{step.error.code}]: {step.error.message}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 sm:px-6 flex items-center justify-between text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-zinc-500" />
            Transparent execution trace
          </span>
          <button
            onClick={onClose}
            className="rounded border border-zinc-300 bg-white px-3 py-1 font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
