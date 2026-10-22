/**
 * Universal speech player for Veylo.
 * Prioritizes high-fidelity Amazon Polly neural speech via /api/tts (Joanna Neural).
 * Automatically falls back to the best available natural browser voice if Amazon Polly is unconfigured.
 */

interface SpeechCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err?: unknown) => void;
}

let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activeSpeechRequest: AbortController | null = null;
let speechGeneration = 0;

function releaseAudio(audio: HTMLAudioElement, url: string, stopPlayback: boolean): void {
  audio.onplay = null;
  audio.onended = null;
  audio.onerror = null;

  if (stopPlayback) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // ignore
    }
  }

  if (activeAudio === audio) activeAudio = null;
  if (activeAudioUrl === url) {
    activeAudioUrl = null;
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
}

export function stopAssistantSpeech(): void {
  speechGeneration += 1;

  if (activeSpeechRequest) {
    activeSpeechRequest.abort();
    activeSpeechRequest = null;
  }

  if (activeAudio) {
    releaseAudio(activeAudio, activeAudioUrl ?? "", true);
  } else if (activeAudioUrl) {
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
function speakBrowserSpeech(
  text: string,
  callbacks: SpeechCallbacks | undefined,
  generation: number
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) {
    if (generation === speechGeneration) callbacks?.onEnd?.();
    return;
  }

  if (generation !== speechGeneration) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  const bestVoice = pickBestBrowserVoice();
  if (bestVoice) {
    utterance.voice = bestVoice;
  }

  utterance.onstart = () => {
    if (generation === speechGeneration) callbacks?.onStart?.();
  };

  utterance.onend = () => {
    if (generation === speechGeneration) callbacks?.onEnd?.();
  };

  utterance.onerror = (e) => {
    if (generation !== speechGeneration) return;
    callbacks?.onError?.(e);
    callbacks?.onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Speaks text using Amazon Polly Neural TTS if available; otherwise falls back to browser voice.
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
  const generation = speechGeneration;
  const controller = new AbortController();
  let browserFallbackStarted = false;
  activeSpeechRequest = controller;

  const fallbackToBrowser = () => {
    if (generation !== speechGeneration || browserFallbackStarted) return;
    browserFallbackStarted = true;
    if (activeAudio && activeAudioUrl) {
      releaseAudio(activeAudio, activeAudioUrl, true);
    }
    speakBrowserSpeech(text, callbacks, generation);
  };

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (generation !== speechGeneration) return;

    if (!res.ok) {
      // Amazon Polly is not configured or failed -> gracefully fall back to browser voice
      fallbackToBrowser();
      return;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("audio")) {
      fallbackToBrowser();
      return;
    }

    const blob = await res.blob();
    if (generation !== speechGeneration) return;

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    activeAudioUrl = url;
    activeAudio = audio;

    audio.onplay = () => {
      if (generation === speechGeneration) callbacks?.onStart?.();
    };

    audio.onended = () => {
      if (generation !== speechGeneration) return;
      releaseAudio(audio, url, false);
      callbacks?.onEnd?.();
    };

    audio.onerror = (e) => {
      if (generation !== speechGeneration) return;
      console.warn("[TTS Audio Playback Warning]", e);
      releaseAudio(audio, url, true);
      // On audio decode or playback error, fallback to browser
      fallbackToBrowser();
    };

    await audio.play();
    if (generation !== speechGeneration) releaseAudio(audio, url, true);
  } catch (err) {
    if (generation !== speechGeneration) return;
    console.warn("[TTS Request Error, falling back to Web Speech API]", err);
    fallbackToBrowser();
  } finally {
    if (activeSpeechRequest === controller) activeSpeechRequest = null;
  }
}

