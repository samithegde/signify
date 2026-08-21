import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { interpretSignFrames } from "./sign.functions";
import { primeAudio, speak } from "./speech";

export type Phrase = { id: number; text: string; at: number; confidence: number };

const FRAMES_PER_BURST = 3;
const FRAME_GAP_MS = 320;
const FRAME_WIDTH = 512;

export function useSignReader() {
  const interpret = useServerFn(interpretSignFrames);
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
    if (!video || !video.videoWidth) return null;
    const canvas = (canvasRef.current ??= document.createElement("canvas"));
    const scale = FRAME_WIDTH / video.videoWidth;
    canvas.width = FRAME_WIDTH;
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      primeAudio();
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => stop());

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      videoRef.current = video;

      loopRef.current = true;
      setActive(true);

      void (async () => {
        while (loopRef.current) {
          const frames: string[] = [];
          for (let i = 0; i < FRAMES_PER_BURST && loopRef.current; i++) {
            const frame = grabFrame();
            if (frame) frames.push(frame);
            await new Promise((resolve) => setTimeout(resolve, FRAME_GAP_MS));
          }
          if (!loopRef.current || frames.length === 0) continue;

          setThinking(true);
          try {
            const result = await interpret({ data: { frames, context: transcriptRef.current } });
            const text = result.text?.trim();
            if (text) {
              transcriptRef.current = `${transcriptRef.current} ${text}`.trim().slice(-1200);
              setPhrases((prev) =>
                [
                  ...prev,
                  { id: Date.now(), text, at: Date.now(), confidence: result.confidence },
                ].slice(-40),
              );
              if (voiceRef.current) void speak(text);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Interpretation failed");
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
  }, [grabFrame, interpret, stop]);

  const clear = useCallback(() => {
    setPhrases([]);
    transcriptRef.current = "";
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
