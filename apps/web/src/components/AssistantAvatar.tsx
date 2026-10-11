"use client";

export type AssistantMode = "idle" | "listening" | "thinking" | "speaking";

const MODE_LABEL: Record<AssistantMode, string> = {
  idle: "Ready when you are",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

export function AssistantAvatar({ mode, compact = false }: { mode: AssistantMode; compact?: boolean }) {
  const size = compact ? "h-12 w-12" : "h-[4.5rem] w-[4.5rem]";
  const coreSize = compact ? "h-8 w-8" : "h-11 w-11";
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div
        className={`assistant-avatar assistant-avatar--${mode} relative grid ${size} shrink-0 place-items-center rounded-full`}
        role="img"
        aria-label={`Veylo assistant, ${MODE_LABEL[mode].toLowerCase()}`}
      >
        <span className="assistant-avatar__halo absolute inset-0 rounded-full" />
        <span className="assistant-avatar__orbit assistant-avatar__orbit--one absolute inset-1 rounded-full" />
        <span className="assistant-avatar__orbit assistant-avatar__orbit--two absolute inset-2 rounded-full" />
        <span className={`assistant-avatar__core relative grid ${coreSize} place-items-center rounded-full`}>
          <span className="flex items-center gap-2">
            <span className="assistant-avatar__eye h-1.5 w-1.5 rounded-full" />
            <span className="assistant-avatar__eye h-1.5 w-1.5 rounded-full" />
          </span>
        </span>
      </div>
      <div className={compact ? "hidden sm:block" : ""}>
        <p className={`text-sm font-semibold ${compact ? "text-slate-800" : "text-white"}`}>Veylo</p>
        <p className={`text-xs ${compact ? "text-cyan-800" : "text-cyan-200"}`}>{MODE_LABEL[mode]}</p>
      </div>
    </div>
  );
}
