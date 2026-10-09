"use client";

import React from "react";
import type { TraceStep } from "@veylo/agent";
import { X, Terminal, Cpu, ShieldCheck } from "lucide-react";

interface AgentTraceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  trace: TraceStep[];
  stepsUsed: number;
  maxSteps?: number;
}

export function AgentTraceDrawer({
  isOpen,
  onClose,
  trace,
  stepsUsed,
  maxSteps = 8,
}: AgentTraceDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                <span>Agent Planner Trace</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-200 text-slate-800">
                  {stepsUsed}/{maxSteps} steps
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Inspectable, evidence-first execution log (MCP spec 2025-11-25)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Trace Steps Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {trace.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No planner steps executed yet. Run a search to observe tool calls.
            </div>
          ) : (
            trace.map((step) => {
              const isTool = step.kind === "tool";
              const isAsk = step.kind === "ask";
              const isStop = step.kind === "stop";

              return (
                <div
                  key={step.step}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  {/* Step Header */}
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-mono font-bold">
                        {step.step}
                      </span>
                      {isTool && (
                        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {step.tool}()
                        </span>
                      )}
                      {isAsk && (
                        <span className="font-mono text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          ask_user()
                        </span>
                      )}
                      {isStop && (
                        <span className="font-mono text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          stop_planner()
                        </span>
                      )}
                    </div>

                    {/* Provider Tag */}
                    {step.provider && (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                        <Cpu className="w-3 h-3 text-slate-400" />
                        <span>{step.provider}</span>
                      </div>
                    )}
                  </div>

                  {/* Decision Rationale */}
                  <div className="mb-2.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Decision Rationale:
                    </span>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">
                      {step.decision}
                    </p>
                  </div>

                  {/* Input Summary */}
                  {step.inputSummary && (
                    <div className="mb-2 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                        Tool Input:
                      </span>
                      <p className="font-mono text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200 break-all">
                        {step.inputSummary}
                      </p>
                    </div>
                  )}

                  {/* Output Summary */}
                  {step.outputSummary && (
                    <div className="text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                        Tool Output:
                      </span>
                      <p className="font-mono text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-200 break-all">
                        {step.outputSummary}
                      </p>
                    </div>
                  )}

                  {/* Question */}
                  {step.question && (
                    <div className="p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 mt-2">
                      <span className="font-bold">Clarification prompt:</span> &ldquo;{step.question}&rdquo;
                    </div>
                  )}

                  {/* Confidence Change or Evidence count */}
                  {(step.confidenceChange || step.evidenceAdded !== undefined) && (
                    <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                      {step.confidenceChange && (
                        <span>
                          Confidence: {step.confidenceChange.from !== undefined ? `${Math.round(step.confidenceChange.from * 100)}% → ` : ""}
                          <strong className="text-slate-800">{Math.round(step.confidenceChange.to * 100)}%</strong>
                        </span>
                      )}
                      {step.evidenceAdded !== undefined && step.evidenceAdded > 0 && (
                        <span>
                          Evidence records added: <strong className="text-emerald-700">+{step.evidenceAdded}</strong>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Error display */}
                  {step.error && (
                    <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
                      <strong>Error [{step.error.code}]:</strong> {step.error.message}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Observable decisions only. Zero private chain-of-thought leaked.
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-100 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

