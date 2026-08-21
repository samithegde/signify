import { SIGN_SYSTEM_PROMPT } from "./sign.shared";

export async function interpretFrames(input: { frames: string[]; context?: string }) {
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
        { role: "system", content: SIGN_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Previous transcript (do not repeat): ${input.context?.slice(-600) || "(none)"}`,
            },
            ...input.frames.map((url) => ({ type: "image_url" as const, image_url: { url } })),
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
}
