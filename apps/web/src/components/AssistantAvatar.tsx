"use client";

import React from "react";

export type AssistantMode = "idle" | "listening" | "thinking" | "speaking";

const MODE_LABEL: Record<AssistantMode, string> = {
  idle: "Ready",
  listening: "Listening...",
  thinking: "Reasoning with MCP...",
  speaking: "Speaking...",
};

interface AssistantAvatarProps {
  mode: AssistantMode;
  compact?: boolean;
  nav?: boolean;
  animationOnly?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function AssistantAvatar({
  mode,
  compact = false,
  nav = false,
  animationOnly = false,
  className = "",
  size,
}: AssistantAvatarProps) {
  // Determine pixel sizes
  const effectiveSize = size || (nav ? "sm" : compact ? "md" : "lg");

  const containerSizes: Record<string, string> = {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-12 w-12 sm:h-14 sm:w-14",
    xl: "h-16 w-16 sm:h-20 sm:w-20",
  };

  const coreSizes: Record<string, string> = {
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-8 w-8 sm:h-9 sm:w-9",
    xl: "h-11 w-11 sm:h-14 sm:w-14",
  };

  const cSize = containerSizes[effectiveSize] || containerSizes.md;
  const coreSize = coreSizes[effectiveSize] || coreSizes.md;

  return (
    <div
      className={`inline-flex items-center gap-2.5 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={`Alexa+ AI Assistant, ${MODE_LABEL[mode]}`}
    >
      <div
        className={`alexa-avatar alexa-avatar--${mode} relative grid ${cSize} shrink-0 place-items-center rounded-full select-none`}
      >
        {/* Atmospheric Cyan/Blue Halo Glow */}
        <span
          className={`alexa-avatar__halo absolute inset-0 rounded-full ${
            mode === "idle" ? "opacity-40" : "opacity-80"
          } transition-opacity duration-500`}
        />

        {/* Dual High-Tech Orbiting Light Arcs (Alexa / AWS Stream) */}
        <span
          className={`alexa-avatar__orbit alexa-avatar__orbit--outer absolute inset-0.5 rounded-full ${
            mode === "thinking"
              ? "opacity-100"
              : mode === "listening"
                ? "opacity-75"
                : "opacity-30"
          } transition-opacity duration-300`}
        />
        <span
          className={`alexa-avatar__orbit alexa-avatar__orbit--inner absolute inset-1 rounded-full ${
            mode === "thinking"
              ? "opacity-100"
              : mode === "speaking"
                ? "opacity-70"
                : "opacity-20"
          } transition-opacity duration-300`}
        />

        {/* Dark Precision Glass Core */}
        <div
          className={`alexa-avatar__core relative grid ${coreSize} place-items-center rounded-full border border-cyan-400/30 overflow-hidden shadow-inner`}
        >
          {/* Specular Light Reflection */}
          <span className="absolute -top-1 -left-1 h-2/3 w-2/3 rounded-full bg-gradient-to-br from-white/30 via-white/5 to-transparent pointer-events-none" />

          {/* Luminous State Center */}
          {mode === "idle" && (
            <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)] transition-all duration-300" />
          )}

          {mode === "listening" && (
            <div className="relative flex items-center justify-center">
              <span className="absolute h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-amber-400/40 animate-ping" />
              <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,1)]" />
            </div>
          )}

          {mode === "thinking" && (
            <div className="relative flex items-center justify-center">
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(6,182,212,1)]" />
            </div>
          )}

          {mode === "speaking" && (
            <div className="flex items-center gap-0.5 h-2.5 sm:h-3">
              <span className="w-0.5 h-full rounded-full bg-cyan-300 animate-wave-1 origin-bottom shadow-[0_0_4px_rgba(6,182,212,0.8)]" />
              <span className="w-0.5 h-full rounded-full bg-cyan-200 animate-wave-2 origin-bottom shadow-[0_0_4px_rgba(6,182,212,0.8)]" />
              <span className="w-0.5 h-full rounded-full bg-cyan-300 animate-wave-3 origin-bottom shadow-[0_0_4px_rgba(6,182,212,0.8)]" />
            </div>
          )}
        </div>
      </div>

      {/* Optional Mode Label */}
      {!animationOnly && !nav && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-zinc-900 leading-none">
              Alexa+
            </span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-800 border border-cyan-200/60">
              AWS
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 leading-none mt-1">
            {MODE_LABEL[mode]}
          </span>
        </div>
      )}
    </div>
  );
}
