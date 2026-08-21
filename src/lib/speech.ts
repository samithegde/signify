/** Streaming PCM playback of the /api/tts endpoint, queued so speech never overlaps. */

let ctx: AudioContext | null = null;
let playhead = 0;
let chain: Promise<void> = Promise.resolve();

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext({ sampleRate: 24000 });
  return ctx;
}

async function speakNow(text: string): Promise<void> {
  const audio = getContext();
  if (audio.state === "suspended") await audio.resume().catch(() => {});

  let pending = new Uint8Array(0);
  const schedule = (incoming: Uint8Array) => {
    const bytes = new Uint8Array(pending.length + incoming.length);
    bytes.set(pending);
    bytes.set(incoming, pending.length);
    const usable = bytes.length - (bytes.length % 2);
    pending = bytes.slice(usable);
    if (usable === 0) return;
    const samples = new Int16Array(bytes.buffer, 0, usable / 2);
    const floats = Float32Array.from(samples, (s) => s / 32768);
    const buffer = audio.createBuffer(1, floats.length, 24000);
    buffer.copyToChannel(floats, 0);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    playhead = playhead === 0 ? audio.currentTime + 0.05 : Math.max(playhead, audio.currentTime);
    source.start(playhead);
    playhead += buffer.duration;
  };

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Voice failed: ${res.status} ${await res.text().catch(() => "")}`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffered = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffered += value;
    const events = buffered.split("\n\n");
    buffered = events.pop() ?? "";
    for (const event of events) {
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payloadText = line.slice(5).trim();
        if (!payloadText || payloadText === "[DONE]") continue;
        let payload: { type?: string; audio?: string };
        try {
          payload = JSON.parse(payloadText);
        } catch {
          continue;
        }
        if (payload.type !== "speech.audio.delta" || !payload.audio) continue;
        const binary = atob(payload.audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        schedule(bytes);
      }
    }
  }
}

/** Queue a phrase for playback. Resolves when this phrase finished streaming. */
export function speak(text: string): Promise<void> {
  chain = chain.then(() => speakNow(text).catch((error) => console.error(error)));
  return chain;
}

export function primeAudio() {
  const audio = getContext();
  if (audio.state === "suspended") void audio.resume().catch(() => {});
}
