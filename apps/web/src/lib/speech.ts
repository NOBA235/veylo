/**
 * Universal speech player for Veylo.
 * Prioritizes high-fidelity ElevenLabs neural speech via /api/tts.
 * Automatically falls back to the best available natural browser voice if ElevenLabs is unconfigured.
 */

interface SpeechCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err?: unknown) => void;
}

let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;

export function stopAssistantSpeech(): void {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudio = null;
  }

  if (activeAudioUrl) {
    try {
      URL.revokeObjectURL(activeAudioUrl);
    } catch {
      // ignore
    }
    activeAudioUrl = null;
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

/**
 * Finds the highest quality English natural or female voice available in the browser.
 */
function pickBestBrowserVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // 1. Prioritize Microsoft / Google Natural Online voices (Jenny, Aria, Natural)
  const preferred = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      (v.name.includes("Natural") ||
        v.name.includes("Jenny") ||
        v.name.includes("Aria") ||
        v.name.includes("Google US English") ||
        v.name.includes("Samantha"))
  );
  if (preferred) return preferred;

  // 2. Any female English voice
  const femaleEn = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      (v.name.toLowerCase().includes("female") ||
        v.name.toLowerCase().includes("zira") ||
        v.name.toLowerCase().includes("susan"))
  );
  if (femaleEn) return femaleEn;

  // 3. Any English voice
  const anyEn = voices.find((v) => v.lang.startsWith("en"));
  return anyEn || voices[0] || null;
}

/**
 * Fallback to browser SpeechSynthesis.
 */
function speakBrowserSpeech(text: string, callbacks?: SpeechCallbacks): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) {
    callbacks?.onEnd?.();
    return;
  }

  stopAssistantSpeech();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  const bestVoice = pickBestBrowserVoice();
  if (bestVoice) {
    utterance.voice = bestVoice;
  }

  utterance.onstart = () => {
    callbacks?.onStart?.();
  };

  utterance.onend = () => {
    callbacks?.onEnd?.();
  };

  utterance.onerror = (e) => {
    callbacks?.onError?.(e);
    callbacks?.onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Speaks text using ElevenLabs TTS if available; otherwise falls back to browser voice.
 */
export async function speakAssistantText(
  text: string,
  callbacks?: SpeechCallbacks
): Promise<void> {
  if (!text || typeof window === "undefined") {
    callbacks?.onEnd?.();
    return;
  }

  stopAssistantSpeech();

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      // ElevenLabs is not configured or failed -> gracefully fall back to browser voice
      speakBrowserSpeech(text, callbacks);
      return;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("audio")) {
      speakBrowserSpeech(text, callbacks);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    activeAudioUrl = url;

    const audio = new Audio(url);
    activeAudio = audio;

    audio.onplay = () => {
      callbacks?.onStart?.();
    };

    audio.onended = () => {
      stopAssistantSpeech();
      callbacks?.onEnd?.();
    };

    audio.onerror = (e) => {
      console.warn("[TTS Audio Playback Warning]", e);
      stopAssistantSpeech();
      // On audio decode or playback error, fallback to browser
      speakBrowserSpeech(text, callbacks);
    };

    await audio.play();
  } catch (err) {
    console.warn("[TTS Request Error, falling back to Web Speech API]", err);
    speakBrowserSpeech(text, callbacks);
  }
}
