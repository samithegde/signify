import { SIGN_SYSTEM_PROMPT } from "./sign.shared";

export async function interpretFrames(input: { frames: string[]; context?: string | undefined }) {
  const key = process.env["AI_API_KEY"];
  if (!key) throw new Error("Missing AI_API_KEY");
  const baseUrl = process.env["GEMINI_API_BASE_URL"] || "https://generativelanguage.googleapis.com/v1beta";
  const model = process.env["SIGN_INTERPRETATION_MODEL"] || "gemini-3.6-flash";
  const parts = input.frames.map((frame) => {
    const match = frame.match(/^data:([^;,]+)[^,]*,(.+)$/);
    if (!match?.[1] || !match[2]) throw new Error("Invalid sign frame");
    return { inlineData: { mimeType: match[1], data: match[2] } };
  });

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SIGN_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: `Previous transcript: ${input.context?.slice(-600) || "(none)"}` }, ...parts] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
        },
      }),
    },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let detail = "";
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      detail = parsed.error?.message ?? "";
    } catch {
      detail = body.slice(0, 240);
    }
    throw new Error(`Sign interpretation failed: ${response.status}${detail ? ` - ${detail}` : ""}`);
  }
  const json = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const raw = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { text: "", confidence: 0 };
  try {
    const result = JSON.parse(match[0]) as { text?: string; confidence?: number };
    return { text: (result.text ?? "").trim(), confidence: Math.max(0, Math.min(1, result.confidence ?? 0)) };
  } catch {
    return { text: "", confidence: 0 };
  }
}

export async function transcribeAudio(input: { audio: string; context?: string | undefined }) {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new Error("Missing GROQ_API_KEY");

  const match = input.audio.match(/^data:([^;,]+)[^,]*,(.+)$/);
  if (!match?.[1] || !match[2]) throw new Error("Invalid audio payload");

  const model = process.env["GROQ_WHISPER_MODEL"] || "whisper-large-v3-turbo";
  const audioBytes = Buffer.from(match[2], "base64");
  const form = new FormData();
  const extension = match[1].split("/")[1]?.split(";")[0] || "webm";
  form.append("file", new Blob([audioBytes], { type: match[1] }), `audio.${extension}`);
  form.append("model", model);
  form.append("response_format", "json");
  form.append("temperature", "0");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Audio transcription failed: ${response.status} ${body}`);
  }

  const json = (await response.json()) as { text?: string };
  return { text: (json.text ?? "").trim() };
}
