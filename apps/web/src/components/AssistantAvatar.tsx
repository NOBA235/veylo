"use client";

export type AssistantMode = "idle" | "listening" | "thinking" | "speaking";

const MODE_LABEL: Record<AssistantMode, string> = {
  idle: "Ready when you are",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

export function AssistantAvatar({ mode }: { mode: AssistantMode }) {
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div
        className={`assistant-avatar assistant-avatar--${mode} relative grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-full`}
        role="img"
        aria-label={`Veylo assistant, ${MODE_LABEL[mode].toLowerCase()}`}
      >
        <span className="assistant-avatar__halo absolute inset-0 rounded-full" />
        <span className="assistant-avatar__orbit assistant-avatar__orbit--one absolute inset-1 rounded-full" />
        <span className="assistant-avatar__orbit assistant-avatar__orbit--two absolute inset-2 rounded-full" />
        <span className="assistant-avatar__core relative grid h-11 w-11 place-items-center rounded-full">
          <span className="flex items-center gap-2">
            <span className="assistant-avatar__eye h-1.5 w-1.5 rounded-full" />
            <span className="assistant-avatar__eye h-1.5 w-1.5 rounded-full" />
          </span>
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-white">Veylo</p>
        <p className="text-xs text-cyan-200">{MODE_LABEL[mode]}</p>
      </div>
    </div>
  );
}
