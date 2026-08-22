import { z } from "zod";

export const AudioTranscriptionInput = z.object({
  /** Browser-recorded audio chunk as a data URL. */
  audio: z.string().min(64).max(12_000_000),
  /** Recently transcribed words so the model can avoid repeating them. */
  context: z.string().max(2000).optional(),
});

export const SignFramesInput = z.object({
  frames: z.array(z.string().min(32)).min(1).max(6),
  context: z.string().max(2000).optional(),
});

export const SIGN_SYSTEM_PROMPT = `You are an ASL fingerspelling interpreter watching consecutive screen frames.
Interpret only the clearly visible new ASL letters or short phrases. Focus on hand shape, finger positions, and the order of letters across frames.
Reply with strict JSON only: {"text": string, "confidence": number}.
Use uppercase letters for isolated fingerspelled letters and natural sentence case for a clearly completed phrase.
If the hand is absent, blurred, too small, or ambiguous, return {"text":"","confidence":0}.
Never guess. Do not repeat text already in the previous transcript. Keep the response short.`;
