import { useCallback, useEffect, useRef, useState } from "react";
import { primeAudio, speak } from "./speech";

export type Phrase = { id: number; text: string; at: number; confidence: number };

type Landmark = { x: number; y: number; z: number };
type HandResults = { multiHandLandmarks?: Landmark[][] };
type ASLLetter =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "L"
  | "O"
  | "P"
  | "T"
  | "U"
  | "V"
  | "W"
  | "Y";
type HandsInstance = {
  onResults(callback: (results: HandResults) => void): void;
  send(input: { image: HTMLVideoElement }): Promise<void>;
  close(): void;
};
type HandsConstructor = new (config: { locateFile: (file: string) => string }) => HandsInstance;

declare global {
  interface Window {
    Hands?: HandsConstructor;
  }
}

const WINDOW_SIZE = 18;
const MAX_HANDS = 2;
const LANDMARKS_PER_HAND = 21;
const VALUES_PER_LANDMARK = 3;
const FEATURE_SIZE = MAX_HANDS * LANDMARKS_PER_HAND * VALUES_PER_LANDMARK;
const SCRIPT_ID = "mediapipe-hands-script";
const MEDIAPIPE_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/hands";
const SPEAK_COOLDOWN_MS = 900;
const STABILITY_WINDOW = 24;
const MIN_STABLE_FRAMES = 16;
const NO_HAND_RESET_FRAMES = 10;

let handsLoader: Promise<HandsConstructor> | null = null;

function loadHands() {
  if (window.Hands) return Promise.resolve(window.Hands);
  if (handsLoader) return handsLoader;

  handsLoader = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => (window.Hands ? resolve(window.Hands) : reject()));
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = `${MEDIAPIPE_BASE}/hands.js`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () =>
      window.Hands ? resolve(window.Hands) : reject(new Error("MediaPipe Hands failed to load"));
    script.onerror = () => reject(new Error("Could not load MediaPipe Hands"));
    document.head.appendChild(script);
  });

  return handsLoader;
}

function createHands(Hands: HandsConstructor) {
  const hands = new Hands({
    locateFile: (file) => `${MEDIAPIPE_BASE}/${file}`,
  }) as HandsInstance & {
    setOptions(options: {
      selfieMode: boolean;
      maxNumHands: number;
      modelComplexity: number;
      minDetectionConfidence: number;
      minTrackingConfidence: number;
    }): void;
  };

  hands.setOptions({
    selfieMode: false,
    maxNumHands: MAX_HANDS,
    modelComplexity: 0,
    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.5,
  });

  return hands;
}

function extractKeypoints(results: HandResults) {
  const keypoints = new Float32Array(FEATURE_SIZE);
  const hands = [...(results.multiHandLandmarks ?? [])]
    .slice(0, MAX_HANDS)
    .sort((a, b) => a[0].x - b[0].x);

  hands.forEach((hand, handIndex) => {
    const wrist = hand[0];
    hand.slice(0, LANDMARKS_PER_HAND).forEach((point, pointIndex) => {
      const offset = (handIndex * LANDMARKS_PER_HAND + pointIndex) * VALUES_PER_LANDMARK;
      keypoints[offset] = point.x - wrist.x;
      keypoints[offset + 1] = point.y - wrist.y;
      keypoints[offset + 2] = point.z - wrist.z;
    });
  });

  return keypoints;
}

function distance(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function palmScale(hand: Landmark[]) {
  return Math.max(0.001, distance(hand[0], hand[9]));
}

function isFingerExtended(hand: Landmark[], tip: number, pip: number, mcp: number) {
  const scale = palmScale(hand);
  const wrist = hand[0];
  const tipFromWrist = distance(hand[tip], wrist);
  const pipFromWrist = distance(hand[pip], wrist);
  const tipFromMcp = distance(hand[tip], hand[mcp]);
  const pipFromMcp = distance(hand[pip], hand[mcp]);

  return (
    tipFromWrist > pipFromWrist + scale * 0.12 &&
    tipFromMcp > pipFromMcp + scale * 0.08 &&
    hand[tip].y < hand[pip].y + scale * 0.08
  );
}

function isThumbExtended(hand: Landmark[]) {
  const scale = palmScale(hand);
  const wrist = hand[0];
  const indexBase = hand[5];
  const thumbIp = hand[3];
  const thumbTip = hand[4];
  const palmDirection = Math.sign(indexBase.x - wrist.x) || 1;

  return (
    Math.sign(thumbTip.x - indexBase.x) === palmDirection &&
    Math.abs(thumbTip.x - indexBase.x) > scale * 0.28 &&
    distance(thumbTip, indexBase) > distance(thumbIp, indexBase) + scale * 0.08
  );
}

function classifyASLLetter(results: HandResults): { letter: ASLLetter; confidence: number } | null {
  const hand = results.multiHandLandmarks?.[0];
  if (!hand) return null;

  const scale = palmScale(hand);
  const index = isFingerExtended(hand, 8, 6, 5);
  const middle = isFingerExtended(hand, 12, 10, 9);
  const ring = isFingerExtended(hand, 16, 14, 13);
  const pinky = isFingerExtended(hand, 20, 18, 17);
  const thumb = isThumbExtended(hand);
  const extendedFingers = [index, middle, ring, pinky].filter(Boolean).length;
  const folded = [index, middle, ring, pinky].filter((extended) => !extended).length;
  const thumbToIndex = distance(hand[4], hand[8]) / scale;
  const thumbToMiddle = distance(hand[4], hand[12]) / scale;
  const thumbToPinky = distance(hand[4], hand[20]) / scale;
  const confidence = (match: number, total = 1) => Math.min(0.96, 0.68 + (match / total) * 0.24);

  const fingertipSpan = distance(hand[8], hand[20]) / scale;
  const indexVertical = hand[8].y < hand[5].y - scale * 0.25;
  const thumbVertical = hand[4].y < hand[2].y - scale * 0.15;
  const fingersClosed = extendedFingers === 0;

  if (fingersClosed) {
    if (thumbToIndex < 0.42 && thumbToMiddle < 0.52) return { letter: "O", confidence: confidence(1) };
    if (thumbToIndex < 0.38 && thumbToMiddle >= 0.52) return { letter: "T", confidence: confidence(1) };
    if (thumb && thumbToIndex > 0.75 && thumbToPinky > 0.9) return { letter: "A", confidence: confidence(1) };
    if (thumbToIndex >= 0.42 && thumbToIndex < 0.9 && thumbToPinky < 1.15)
      return { letter: "C", confidence: confidence(1) };
    if (thumbToMiddle < 0.65) return { letter: "E", confidence: confidence(1) };
  }

  if (extendedFingers === 4 && !thumb) return { letter: "B", confidence: confidence(1) };
  if (extendedFingers === 3 && !index && thumbToIndex < 0.7)
    return { letter: "F", confidence: confidence(1) };

  if (index && !middle && !ring && !pinky) {
    if (thumb && thumbToIndex > 0.85 && indexVertical && thumbVertical)
      return { letter: "L", confidence: confidence(1) };
    if (thumb && Math.abs(hand[8].y - hand[4].y) < scale * 0.65)
      return { letter: "G", confidence: confidence(1) };
    if (indexVertical && thumbToMiddle < 0.75) return { letter: "D", confidence: confidence(1) };
  }

  if (!index && !middle && !ring && pinky) {
    if (thumb && thumbToPinky > 0.8) return { letter: "Y", confidence: confidence(1) };
    if (!thumb) return { letter: "I", confidence: confidence(1) };
  }

  if (index && middle && !ring && !pinky) {
    if (thumb && hand[8].y > hand[0].y) return { letter: "P", confidence: confidence(1) };
    return { letter: fingertipSpan < 0.62 ? "U" : "V", confidence: confidence(1) };
  }

  if (index && middle && ring && !pinky) return { letter: "W", confidence: confidence(1) };

  return null;
}

function recognizeHandSign(
  results: HandResults,
  keypointBuffer: Float32Array[],
  letterHistory: ASLLetter[],
) {
  if (keypointBuffer.length < WINDOW_SIZE) return { letter: null, text: "", confidence: 0 };

  const prediction = classifyASLLetter(results);
  if (!prediction) return { letter: null, text: "", confidence: 0 };

  letterHistory.push(prediction.letter);
  if (letterHistory.length > STABILITY_WINDOW) letterHistory.shift();

  const counts = letterHistory.reduce(
    (next, item) => ({ ...next, [item]: (next[item] ?? 0) + 1 }),
    {} as Partial<Record<ASLLetter, number>>,
  );
  const [stableLetter, stableCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] as [
    ASLLetter,
    number,
  ];

  if (stableCount < MIN_STABLE_FRAMES) return { letter: null, text: "", confidence: 0 };

  return {
    letter: stableLetter,
    text: stableLetter,
    confidence: Math.min(prediction.confidence, stableCount / STABILITY_WINDOW),
  };
}

export function useMediaPipeSignReader() {
  const [active, setActive] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phrases, setPhrases] = useState<Phrase[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handsRef = useRef<HandsInstance | null>(null);
  const frameRef = useRef<number | null>(null);
  const loopRef = useRef(false);
  const keypointBufferRef = useRef<Float32Array[]>([]);
  const letterHistoryRef = useRef<ASLLetter[]>([]);
  const emittedLetterRef = useRef<ASLLetter | null>(null);
  const noHandFramesRef = useRef(0);
  const lastSpokenRef = useRef("");
  const lastSpokenAtRef = useRef(0);
  const voiceRef = useRef(true);

  voiceRef.current = voiceOn;

  const stop = useCallback(() => {
    loopRef.current = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setActive(false);
    setThinking(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    handsRef.current?.close();
    handsRef.current = null;
    keypointBufferRef.current = [];
    letterHistoryRef.current = [];
    emittedLetterRef.current = null;
    noHandFramesRef.current = 0;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  const pushPhrase = useCallback((text: string, confidence: number) => {
    const now = Date.now();
    if (text === lastSpokenRef.current && now - lastSpokenAtRef.current < SPEAK_COOLDOWN_MS) return;

    lastSpokenRef.current = text;
    lastSpokenAtRef.current = now;
    setPhrases((prev) => [...prev, { id: now, text, at: now, confidence }].slice(-40));
    if (voiceRef.current) void speak(text);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setThinking(true);

    try {
      primeAudio();
      const Hands = await loadHands();
      const hands = createHands(Hands);
      handsRef.current = hands;

      hands.onResults((results) => {
        const buffer = keypointBufferRef.current;
        buffer.push(extractKeypoints(results));
        if (buffer.length > WINDOW_SIZE) buffer.shift();

        if (!results.multiHandLandmarks?.length) {
          noHandFramesRef.current += 1;
          if (noHandFramesRef.current >= NO_HAND_RESET_FRAMES) {
            letterHistoryRef.current = [];
            emittedLetterRef.current = null;
            lastSpokenRef.current = "";
          }
          return;
        }

        noHandFramesRef.current = 0;
        const prediction = recognizeHandSign(results, buffer, letterHistoryRef.current);
        if (prediction.letter && prediction.letter !== emittedLetterRef.current) {
          emittedLetterRef.current = prediction.letter;
          pushPhrase(prediction.text, prediction.confidence);
        }
      });

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => stop());

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      videoRef.current = video;

      loopRef.current = true;
      setActive(true);
      setThinking(false);

      const processFrame = async () => {
        if (!loopRef.current || !videoRef.current || !handsRef.current) return;
        await handsRef.current.send({ image: videoRef.current });
        frameRef.current = requestAnimationFrame(processFrame);
      };

      frameRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start hand-sign recognition");
      stop();
    }
  }, [pushPhrase, stop]);

  const clear = useCallback(() => {
    setPhrases([]);
    letterHistoryRef.current = [];
    emittedLetterRef.current = null;
    lastSpokenRef.current = "";
    lastSpokenAtRef.current = 0;
  }, []);

  return {
    active,
    thinking,
    error,
    phrases,
    voiceOn,
    setVoiceOn,
    start,
    stop,
    clear,
    latest: phrases[phrases.length - 1] ?? null,
  };
}

const GEMINI_FRAMES_PER_BURST = 3;
const GEMINI_FRAME_GAP_MS = 300;
const GEMINI_FRAME_WIDTH = 640;

export function useSignReader() {
  const [active, setActive] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loopRef = useRef(false);
  const transcriptRef = useRef("");
  const voiceRef = useRef(true);
  voiceRef.current = voiceOn;

  const stop = useCallback(() => {
    loopRef.current = false;
    setActive(false);
    setThinking(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  const grabFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video?.videoWidth) return null;
    const canvas = (canvasRef.current ??= document.createElement("canvas"));
    const scale = GEMINI_FRAME_WIDTH / video.videoWidth;
    canvas.width = GEMINI_FRAME_WIDTH;
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.78);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      primeAudio();
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", stop);
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      videoRef.current = video;
      loopRef.current = true;
      setActive(true);

      void (async () => {
        while (loopRef.current) {
          const frames: string[] = [];
          for (let index = 0; index < GEMINI_FRAMES_PER_BURST && loopRef.current; index += 1) {
            const frame = grabFrame();
            if (frame) frames.push(frame);
            await new Promise((resolve) => setTimeout(resolve, GEMINI_FRAME_GAP_MS));
          }
          if (!loopRef.current || !frames.length) continue;
          setThinking(true);
          try {
            const response = await fetch("/api/interpret", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ frames, context: transcriptRef.current }),
            });
            const result = (await response.json()) as { text?: string; confidence?: number; error?: string };
            if (!response.ok) throw new Error(result.error ?? `Gemini interpretation failed (${response.status})`);
            const text = result.text?.trim();
            if (text && (result.confidence ?? 0) >= 0.55) {
              transcriptRef.current = `${transcriptRef.current} ${text}`.trim().slice(-1200);
              const phrase = { id: Date.now(), text, at: Date.now(), confidence: result.confidence ?? 0.55 };
              setPhrases((previous) => [...previous, phrase].slice(-40));
              if (voiceRef.current) void speak(text);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Gemini interpretation failed");
            await new Promise((resolve) => setTimeout(resolve, 1500));
          } finally {
            setThinking(false);
          }
        }
      })();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start screen capture");
      stop();
    }
  }, [grabFrame, stop]);

  const clear = useCallback(() => {
    setPhrases([]);
    transcriptRef.current = "";
  }, []);

  return { active, thinking, error, phrases, voiceOn, setVoiceOn, start, stop, clear, latest: phrases[phrases.length - 1] ?? null };
}
