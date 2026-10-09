"use client";

import React from "react";
import { X, Radio, Volume2, ShieldCheck } from "lucide-react";

interface AlexaSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: string;
  category?: string;
  storeName?: string;
  evidenceStatus?: string;
}

export function AlexaSimulationModal({
  isOpen,
  onClose,
  product = "USB-C to HDMI adapter",
  category = "video adapters",
  storeName = "Fixture Electronics",
  evidenceStatus = "LIKELY",
}: AlexaSimulationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 text-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-800 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Device Bezel Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <span className="font-semibold text-sm tracking-wide text-cyan-200">
              Echo Show 10 • Alexa+ Agent Simulation
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alexa+ Screen Interface */}
        <div className="p-6 space-y-6">
          {/* Simulated Dialogue */}
          <div className="space-y-4 text-sm">
            {/* User Voice */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0 mt-0.5">
                U
              </div>
              <div className="bg-slate-800/80 rounded-2xl rounded-tl-xs px-4 py-3 text-slate-200 max-w-lg border border-slate-700/60">
                <span className="text-[11px] text-slate-400 block mb-1 font-mono">User spoke:</span>
                &ldquo;Alexa, I need that little thing that lets me plug my laptop into the TV. I don&apos;t know what it&apos;s called.&rdquo;
              </div>
            </div>

            {/* Behind the scenes: MCP Call */}
            <div className="ml-10 p-2.5 rounded-xl bg-slate-950/80 border border-cyan-900/40 text-xs text-cyan-300 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
              <span>
                <strong>Alexa+ calls Veylo MCP:</strong> <code className="font-mono text-cyan-200">identify_product()</code> → {product} ({category})
              </span>
            </div>

            {/* Alexa Voice Response */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 shadow-sm">
                A+
              </div>
              <div className="bg-cyan-950/40 border border-cyan-800/60 rounded-2xl rounded-tl-xs px-4 py-3 text-cyan-100 max-w-lg">
                <span className="text-[11px] text-cyan-400 block mb-1 font-mono flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> Alexa+ Agent Response:
                </span>
                &ldquo;You probably mean a <strong className="text-white">{product}</strong>. Do you need one nearby today, or are you okay ordering online?&rdquo;
              </div>
            </div>

            {/* User Confirmation */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0 mt-0.5">
                U
              </div>
              <div className="bg-slate-800/80 rounded-2xl rounded-tl-xs px-4 py-2.5 text-slate-200 max-w-lg border border-slate-700/60">
                &ldquo;Yeah, I need it today nearby.&rdquo;
              </div>
            </div>

            {/* Behind the scenes: Local Discovery + Evidence */}
            <div className="ml-10 p-2.5 rounded-xl bg-slate-950/80 border border-cyan-900/40 text-xs text-cyan-300 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                <strong>Alexa+ calls Veylo MCP:</strong> <code className="font-mono text-cyan-200">discover_local_places()</code> + <code className="font-mono text-cyan-200">check_local_inventory()</code>
              </span>
            </div>

            {/* Alexa Final Synthesis with Honest Stock */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 shadow-sm">
                A+
              </div>
              <div className="bg-cyan-950/40 border border-cyan-800/60 rounded-2xl rounded-tl-xs px-4 py-3 text-cyan-100 max-w-lg">
                <span className="text-[11px] text-cyan-400 block mb-1 font-mono flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> Alexa+ Agent Synthesis:
                </span>
                &ldquo;I found <strong className="text-white">{storeName}</strong> nearby. They have an online listing for a compatible adapter, but current shelf inventory isn&apos;t confirmed. Would you like me to show directions or call them to confirm?&rdquo;
              </div>
            </div>
          </div>

          {/* Visual Card on Echo Show Display */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block mb-2">
              Echo Show On-Screen Capability Card
            </span>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div>
                <span className="text-xs font-semibold text-white block">{product}</span>
                <span className="text-[11px] text-slate-400">{storeName} • 0.6 km away</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                {evidenceStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Hackathon Simulation: Validates agent composition over MCP
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

