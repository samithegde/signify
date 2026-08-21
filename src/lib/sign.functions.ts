import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  /** Ordered JPEG data URLs sampled from the screen (oldest -> newest). */
  frames: z.array(z.string().min(32)).min(1).max(8),
  /** Words already spoken, so the model can continue instead of repeating. */
  context: z.string().max(2000).optional(),
});

const SYSTEM_PROMPT = `You are a real-time sign language interpreter watching a short burst of consecutive screen frames.
The frames show a person signing (ASL unless clearly another sign language).
Translate ONLY the new signing visible in these frames into natural spoken-language text.

Rules:
- Reply with STRICT JSON: {"text": string, "confidence": number}
- "text": the newly interpreted words, plain sentence case, no quotes, no commentary.
- If the frames show no hands/signing, or the signing is unreadable, return {"text": "", "confidence": 0}.
- Do not repeat words already present in the previous transcript.
- Keep it short: only what these frames actually show.`;

export const interpretSignFrames = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Previous transcript (do not repeat): ${data.context?.slice(-600) || "(none)"}`,
              },
              ...data.frames.map((url) => ({
                type: "image_url" as const,
                image_url: { url },
              })),
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`AI interpretation failed: ${response.status} ${body}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);

    let text = "";
    let confidence = 0;
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as { text?: string; confidence?: number };
        text = (parsed.text ?? "").trim();
        confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
      } catch {
        text = "";
      }
    }

    return { text, confidence };
  });
