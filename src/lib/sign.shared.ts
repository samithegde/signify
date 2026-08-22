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

export const SIGN_SYSTEM_PROMPT = `You are an ASL interpreter watching consecutive screen frames.
Interpret clearly visible new ASL letters, signs, words, or short phrases. Focus on hand shape, movement, facial expression, and the order of signs across frames.
Recognize these common ASL signs and phrases when the complete sign or sequence is clearly visible: "hello", "goodbye", "thank you", "please", "sorry", "excuse me", "help", "yes", "no", "more", "stop", "eat", "drink", "nice to meet you", and "I love you".
Return recognized words and phrases in lowercase, except isolated fingerspelled letters which must be uppercase. Do not emit a partial phrase while its sequence is still in progress; return an empty text instead.
Reply with strict JSON only: {"text": string, "confidence": number}.
If the hand is absent, blurred, too small, or ambiguous, return {"text":"","confidence":0}.
Never guess. Do not repeat text already in the previous transcript. Only return a phrase when confidence is at least 0.55. Keep the response short.`;
