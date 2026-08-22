import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Contrast,
  Ghost,
  Hand,
  Keyboard,
  Mic,
  MicOff,
  Play,
  Settings,
  Square,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useOverlaySettings } from "@/lib/overlaySettings";
import { useSignReader } from "@/lib/useSignReader";
import { useOverlayDrag, useOverlayResize } from "@/lib/useOverlayDrag";
import { Dashboard } from "./-dashboard";
import signifyBasicBrandmarkUrl from "../../assets/signifybasicbrandmark.png?url";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Signify - Live Hand Sign Captions" },
      {
        name: "description",
        content:
          "A desktop overlay that watches your screen, recognizes hand signs locally, and speaks and captions the words in real time.",
      },
      {
        property: "og:title",
        content: "Signify - Live Hand Sign Captions",
      },
      {
        property: "og:description",
        content:
          "Reads sign language from anything on your screen and turns it into spoken words and live captions.",
      },
    ],
  }),
  component: App,
});

const TRANSLUCENCY = [0.42, 0.68, 0.9];
const AUDIO_CHUNK_MS = 4200;

function App() {
  return new URLSearchParams(window.location.search).has("dashboard") ? (
    <Dashboard />
  ) : (
    <Overlay />
  );
}

function Overlay() {
  const reader = useSignReader();
  const drag = useOverlayDrag();
  const resize = useOverlayResize();
  const [ghost, setGhost] = useState(false);
  const [inShell, setInShell] = useState(false);
  const [settings, updateSettings] = useOverlaySettings();
  const [words, setWords] = useState("Hello");
  const audio = useComputerAudioTranscriber(setWords);
  const { mode, opacity, voiceOn } = settings;

  useEffect(() => setInShell(Boolean(window.overlay?.isElectron)), []);
  useEffect(() => {
    if (mode === "words-to-sign" && reader.active) reader.stop();
  }, [mode, reader]);
  useEffect(() => {
    if (mode === "sign-to-words" && audio.active) audio.stop();
  }, [audio, mode]);
  useEffect(() => {
    reader.setVoiceOn(voiceOn);
  }, [reader, voiceOn]);

  const history = reader.phrases.slice(0, -1).slice(-6);
  const alpha = opacity / 100;
  const signTokens = useMemo(() => buildSignTokens(words), [words]);

  const restoreInteraction = () => {
    if (ghost && window.overlay) {
      void window.overlay.setClickThrough(false).then(setGhost);
    }
  };

  return (
    <main className="flex min-h-screen items-end justify-center bg-transparent p-4 select-none">
      <section
        className="glass relative w-full max-w-2xl overflow-hidden rounded-2xl"
        style={{
          transform: `translate3d(${drag.offset.x}px, ${drag.offset.y}px, 0)`,
          background: `oklch(0.17 0.02 250 / ${alpha})`,
          ...(resize.size
            ? { width: resize.size.w, height: resize.size.h, maxWidth: "none" }
            : {}),
        }}
      >
        <header
          className="drag-region flex items-center gap-2 border-b border-border/60 px-4 py-2.5"
          style={{ cursor: drag.dragging ? "grabbing" : "grab" }}
          onPointerDown={drag.onPointerDown}
          onPointerEnter={restoreInteraction}
          onDoubleClick={() => drag.reset()}
        >
          <span
            className={`pulse-dot ${reader.active || audio.active ? "is-live" : ""}`}
          />
          <img
            className="overlay-brandmark"
            src={signifyBasicBrandmarkUrl}
            alt=""
          />
          <h1 className="text-sm font-semibold tracking-tight">Signify</h1>

          <span className="text-[11px] text-muted-foreground">
            {mode === "sign-to-words"
              ? reader.active
                ? reader.thinking
                  ? "reading signs..."
                  : "watching your screen"
                : "idle"
              : audio.active
                ? audio.transcribing
                  ? "transcribing audio..."
                  : "listening to computer audio"
                : "words to signs"}
          </span>

          <div className="no-drag ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5 rounded-lg bg-secondary/45 px-2 py-1 text-[11px] text-muted-foreground">
              <Hand className="size-3.5" />
              <Switch
                checked={mode === "words-to-sign"}
                aria-label="Switch between sign to words and words to sign"
                onCheckedChange={(checked) =>
                  updateSettings({
                    mode: checked ? "words-to-sign" : "sign-to-words",
                  })
                }
              />
              <Keyboard className="size-3.5" />
            </label>
            {mode === "sign-to-words" && (
              <button
                className="ctl"
                title={voiceOn ? "Mute voice" : "Unmute voice"}
                onClick={() => updateSettings({ voiceOn: !voiceOn })}
              >
                {voiceOn ? (
                  <Mic className="size-4" />
                ) : (
                  <MicOff className="size-4" />
                )}
              </button>
            )}
            <button
              className="ctl"
              title="Cycle translucency"
              onClick={() => {
                const current = TRANSLUCENCY.findIndex(
                  (step) => Math.abs(step - alpha) < 0.02,
                );
                const next =
                  TRANSLUCENCY[(current + 1) % TRANSLUCENCY.length] ??
                  TRANSLUCENCY[0] ??
                  alpha;
                updateSettings({ opacity: Math.round(next * 100) });
              }}
            >
              <Contrast className="size-4" />
            </button>
            {mode === "sign-to-words" ? (
              <button
                className="ctl"
                title="Clear transcript"
                onClick={reader.clear}
              >
                <Trash2 className="size-4" />
              </button>
            ) : (
              <button
                className="ctl"
                title="Clear words"
                onClick={() => setWords("")}
              >
                <Trash2 className="size-4" />
              </button>
            )}
            {inShell && (
              <>
                <button
                  className="ctl"
                  title="Open dashboard"
                  onClick={() => void window.overlay!.openDashboard?.()}
                >
                  <Settings className="size-4" />
                </button>
                <button
                  className={`ctl ${ghost ? "is-on" : ""}`}
                  title={
                    ghost
                      ? "Disable click-through mode"
                      : "Enable click-through mode"
                  }
                  onClick={async () =>
                    setGhost(await window.overlay!.toggleClickThrough())
                  }
                >
                  <Ghost className="size-4" />
                </button>
                <button
                  className="ctl"
                  title="Hide overlay"
                  onClick={() =>
                    void window.overlay!.setOverlayVisible?.(false)
                  }
                >
                  <X className="size-4" />
                </button>
              </>
            )}
          </div>
        </header>

        <div className="no-drag px-5 py-4">
          {mode === "sign-to-words" ? (
            <SignToWords reader={reader} history={history} />
          ) : (
            <WordsToSign
              words={words}
              setWords={setWords}
              signTokens={signTokens}
              audio={audio}
            />
          )}
        </div>

        <div
          className="no-drag grip"
          title="Drag to resize"
          onPointerDown={resize.onPointerDown}
        />
      </section>
    </main>
  );
}

type SignReader = ReturnType<typeof useSignReader>;
type ComputerAudioTranscriber = ReturnType<typeof useComputerAudioTranscriber>;

function useComputerAudioTranscriber(setWords: (words: string) => void) {
  const [active, setActive] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<{ stop: () => void } | null>(null);
  const transcriptRef = useRef("");
  const busyRef = useRef(false);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    busyRef.current = false;
    setActive(false);
    setTranscribing(false);
  }, []);

  useEffect(() => stop, [stop]);

  const transcribe = useCallback(
    async (blob: Blob) => {
      if (!blob.size || busyRef.current) return;
      busyRef.current = true;
      setTranscribing(true);
      setError(null);

      try {
        const audio = await blobToDataUrl(blob);
        const response = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio, context: transcriptRef.current }),
        });
        const result = (await response.json()) as {
          text?: string;
          error?: string;
        };
        if (!response.ok)
          throw new Error(
            result.error ?? `Transcription failed (${response.status})`,
          );

        const text = result.text?.trim();
        if (text) {
          transcriptRef.current = `${transcriptRef.current} ${text}`
            .trim()
            .slice(-1200);
          setWords(transcriptRef.current.slice(-80));
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Audio transcription failed",
        );
      } finally {
        busyRef.current = false;
        setTranscribing(false);
      }
    },
    [setWords],
  );

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      streamRef.current = stream;

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) {
        stop();
        throw new Error(
          "No computer audio track was captured. In a browser, choose a source with audio sharing enabled.",
        );
      }

      stream
        .getTracks()
        .forEach((track) => track.addEventListener("ended", stop));

      const audioStream = new MediaStream(audioTracks);
      const recorder = startAudioRecorder(
        audioStream,
        (event) => {
          if (event.data.size) void transcribe(event.data);
        },
        () => setActive(false),
      );
      recorderRef.current = recorder;
      setActive(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start computer audio capture",
      );
      stop();
    }
  }, [stop, transcribe]);

  const clear = useCallback(() => {
    transcriptRef.current = "";
    setWords("");
    setError(null);
  }, [setWords]);

  return { active, transcribing, error, start, stop, clear };
}

function getSupportedAudioMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function createAudioRecorder(stream: MediaStream, useDefault = false) {
  if (useDefault) return new MediaRecorder(stream);
  const mimeType = getSupportedAudioMimeType();
  try {
    return new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch {
    return new MediaRecorder(stream);
  }
}

function startAudioRecorder(
  stream: MediaStream,
  onData: (event: BlobEvent) => void,
  onStop: () => void,
) {
  let stopped = false;
  let recorder: MediaRecorder | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const startSegment = () => {
    if (stopped) return;
    recorder = createAudioRecorder(stream);
    recorder.addEventListener("dataavailable", onData, { once: true });
    recorder.addEventListener(
      "stop",
      () => {
        if (timer) clearTimeout(timer);
        if (stopped) {
          onStop();
          return;
        }
        startSegment();
      },
      { once: true },
    );
    try {
      recorder.start();
    } catch {
      recorder = createAudioRecorder(stream, true);
      recorder.addEventListener("dataavailable", onData, { once: true });
      recorder.addEventListener(
        "stop",
        () => {
          if (stopped) onStop();
          else startSegment();
        },
        { once: true },
      );
      recorder.start();
    }
    timer = setTimeout(() => recorder?.stop(), AUDIO_CHUNK_MS);
  };

  startSegment();
  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (recorder?.state === "recording") recorder.stop();
    },
  };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read audio"));
    reader.readAsDataURL(blob);
  });
}

function SignToWords({
  reader,
  history,
}: {
  reader: SignReader;
  history: SignReader["phrases"];
}) {
  return (
    <>
      <div className="min-h-[92px]">
        {history.length > 0 && (
          <p className="mb-2 line-clamp-2 text-sm leading-snug text-muted-foreground">
            {history.map((phrase) => phrase.text).join(" ")}
          </p>
        )}
        <p className="caption text-2xl leading-tight font-semibold">
          {reader.latest?.text ??
            (reader.active
              ? "Point me at someone signing..."
              : "Start reading to caption sign language on your screen.")}
        </p>
      </div>

      {reader.error && (
        <p className="mt-3 rounded-lg bg-destructive/15 px-3 py-2 text-xs text-destructive-foreground">
          {reader.error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        {reader.active ? (
          <button
            className="btn-stop"
            title="Stop reading and screen capture"
            onClick={reader.stop}
          >
            <Square className="size-4" /> Stop
          </button>
        ) : (
          <button
            className="btn-go"
            title="Start reading sign language from your screen"
            onClick={reader.start}
          >
            <Play className="size-4" /> Start reading
          </button>
        )}
        <p className="text-[11px] leading-tight text-muted-foreground">
          Sends short screen-frame bursts to Google Gemini for ASL letter and
          phrase recognition, then speaks the result aloud.
        </p>
      </div>
    </>
  );
}

type SignCharacter = {
  kind: "letter";
  id: string;
  character: string;
};

type WholeSign = {
  kind: "sign";
  id: string;
  label: string;
  gloss: string;
  cue: string;
};

type SignSpace = {
  kind: "space";
  id: string;
};

type SignBreak = {
  kind: "break";
  id: string;
};

type SignPunctuation = {
  kind: "punctuation";
  id: string;
  character: string;
};

type SignToken =
  SignCharacter | WholeSign | SignSpace | SignBreak | SignPunctuation;

type WholeSignEntry = {
  label: string;
  gloss: string;
  cue: string;
  aliases?: string[];
};

const WHOLE_SIGN_ENTRIES: WholeSignEntry[] = [
  { label: "hello", gloss: "HELLO", cue: "open hand from forehead" },
  { label: "hi", gloss: "HI", cue: "small greeting wave" },
  { label: "goodbye", gloss: "GOODBYE", cue: "open-close wave" },
  { label: "thank you", gloss: "THANK-YOU", cue: "chin outward" },
  { label: "please", gloss: "PLEASE", cue: "circle on chest" },
  { label: "sorry", gloss: "SORRY", cue: "fist circle on chest" },
  { label: "excuse me", gloss: "EXCUSE-ME", cue: "brushed fingertips" },
  { label: "help", gloss: "HELP", cue: "lifted supporting hand" },
  { label: "yes", gloss: "YES", cue: "nodding fist" },
  { label: "no", gloss: "NO", cue: "closing fingers" },
  { label: "more", gloss: "MORE", cue: "fingertips together" },
  { label: "stop", gloss: "STOP", cue: "chop into palm" },
  { label: "eat", gloss: "EAT", cue: "fingertips to mouth" },
  { label: "drink", gloss: "DRINK", cue: "cup to mouth" },
  { label: "water", gloss: "WATER", cue: "W taps chin" },
  { label: "bathroom", gloss: "BATHROOM", cue: "T shake" },
  { label: "good", gloss: "GOOD", cue: "mouth outward to palm" },
  { label: "bad", gloss: "BAD", cue: "turn hand down" },
  { label: "fine", gloss: "FINE", cue: "open hand on chest" },
  { label: "okay", gloss: "OKAY", cue: "OK hand", aliases: ["ok"] },
  { label: "want", gloss: "WANT", cue: "pull curved hands" },
  { label: "need", gloss: "NEED", cue: "bent finger downward" },
  { label: "like", gloss: "LIKE", cue: "pinch from chest" },
  { label: "love", gloss: "LOVE", cue: "arms crossed" },
  { label: "know", gloss: "KNOW", cue: "tap temple" },
  {
    label: "don't know",
    gloss: "DON'T-KNOW",
    cue: "temple flick",
    aliases: ["dont know"],
  },
  { label: "understand", gloss: "UNDERSTAND", cue: "index pops up" },
  {
    label: "don't understand",
    gloss: "DON'T-UNDERSTAND",
    cue: "understand plus no",
    aliases: ["dont understand"],
  },
  { label: "see", gloss: "SEE", cue: "V from eyes" },
  { label: "look", gloss: "LOOK", cue: "V gaze outward" },
  { label: "go", gloss: "GO", cue: "index fingers move out" },
  { label: "come", gloss: "COME", cue: "index fingers move in" },
  { label: "work", gloss: "WORK", cue: "wrists tap" },
  { label: "home", gloss: "HOME", cue: "mouth to cheek" },
  { label: "school", gloss: "SCHOOL", cue: "clap flat hands" },
  { label: "friend", gloss: "FRIEND", cue: "linked index fingers" },
  { label: "family", gloss: "FAMILY", cue: "F hands circle" },
  { label: "mother", gloss: "MOTHER", cue: "thumb at chin" },
  { label: "father", gloss: "FATHER", cue: "thumb at forehead" },
  { label: "child", gloss: "CHILD", cue: "pat downward" },
  { label: "today", gloss: "TODAY", cue: "Y hands drop" },
  { label: "tomorrow", gloss: "TOMORROW", cue: "thumb forward" },
  { label: "yesterday", gloss: "YESTERDAY", cue: "thumb back" },
  { label: "now", gloss: "NOW", cue: "Y hands down" },
  { label: "later", gloss: "LATER", cue: "L arcs forward" },
  { label: "morning", gloss: "MORNING", cue: "sunrise arm" },
  { label: "night", gloss: "NIGHT", cue: "hand over forearm" },
  { label: "time", gloss: "TIME", cue: "tap wrist" },
  { label: "who", gloss: "WHO", cue: "index circles chin" },
  { label: "what", gloss: "WHAT", cue: "open hands shake" },
  { label: "when", gloss: "WHEN", cue: "index circles index" },
  { label: "where", gloss: "WHERE", cue: "index shakes" },
  { label: "why", gloss: "WHY", cue: "Y from forehead" },
  { label: "how", gloss: "HOW", cue: "hands roll open" },
  { label: "again", gloss: "AGAIN", cue: "fingertips into palm" },
  { label: "slow", gloss: "SLOW", cue: "slide down arm" },
  { label: "name", gloss: "NAME", cue: "H hands tap" },
  { label: "my name", gloss: "MY-NAME", cue: "me plus name" },
  { label: "nice to meet you", gloss: "NICE-MEET-YOU", cue: "nice, meet, you" },
  { label: "i love you", gloss: "I-LOVE-YOU", cue: "ILY hand" },
  { label: "happy", gloss: "HAPPY", cue: "hands brush upward" },
  { label: "sad", gloss: "SAD", cue: "hands down face" },
  { label: "tired", gloss: "TIRED", cue: "bent hands on chest" },
  { label: "sick", gloss: "SICK", cue: "middle fingers touch" },
  { label: "hot", gloss: "HOT", cue: "throw from mouth" },
  { label: "cold", gloss: "COLD", cue: "shaking fists" },
  { label: "me", gloss: "ME", cue: "point to self", aliases: ["i"] },
  { label: "you", gloss: "YOU", cue: "point outward" },
  { label: "we", gloss: "WE", cue: "point around group" },
  { label: "they", gloss: "THEY", cue: "point across" },
];

const SIGN_PATTERNS = WHOLE_SIGN_ENTRIES.flatMap((entry) =>
  [entry.label, ...(entry.aliases ?? [])].map((phrase) => ({
    entry,
    phrase,
    words: normalizeForSignMatch(phrase).split(" "),
  })),
).sort((a, b) => b.words.length - a.words.length);

const SIMPLE_PHRASES = [
  "hello",
  "thank you",
  "please",
  "help",
  "yes",
  "no",
  "more",
  "bathroom",
  "I love you",
  "nice to meet you",
  "don't understand",
  "see you later",
];

function normalizeForSignMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isWordChunk(value: string) {
  return /^[A-Za-z']+$/.test(value);
}

function buildSignTokens(value: string): SignToken[] {
  const chunks =
    value.slice(0, 160).match(/[A-Za-z']+|\s+|[^\sA-Za-z']+/g) ?? [];
  const tokens: SignToken[] = [];

  for (let index = 0; index < chunks.length;) {
    const chunk = chunks[index] ?? "";

    if (/^\s+$/.test(chunk)) {
      tokens.push({
        kind: chunk.includes("\n") ? "break" : "space",
        id: `gap-${index}`,
      });
      index += 1;
      continue;
    }

    if (!isWordChunk(chunk)) {
      tokens.push({
        kind: "punctuation",
        id: `punct-${index}`,
        character: chunk,
      });
      index += 1;
      continue;
    }

    const match = findWholeSignMatch(chunks, index);
    if (match) {
      tokens.push({
        kind: "sign",
        id: `sign-${index}-${match.entry.gloss}`,
        label: match.entry.label,
        gloss: match.entry.gloss,
        cue: match.entry.cue,
      });
      index = match.nextIndex;
      continue;
    }

    [...chunk].forEach((character, offset) => {
      if (/[A-Za-z]/.test(character)) {
        tokens.push({
          kind: "letter",
          id: `letter-${index}-${offset}`,
          character,
        });
      }
    });
    index += 1;
  }

  return tokens;
}

function findWholeSignMatch(chunks: string[], startIndex: number) {
  for (const pattern of SIGN_PATTERNS) {
    let chunkIndex = startIndex;
    let matched = true;

    for (let wordIndex = 0; wordIndex < pattern.words.length; wordIndex += 1) {
      const word = pattern.words[wordIndex];
      const chunk = chunks[chunkIndex];

      if (
        !chunk ||
        !isWordChunk(chunk) ||
        normalizeForSignMatch(chunk) !== word
      ) {
        matched = false;
        break;
      }

      chunkIndex += 1;
      if (wordIndex < pattern.words.length - 1) {
        while (/^\s+$/.test(chunks[chunkIndex] ?? "")) chunkIndex += 1;
      }
    }

    if (matched) return { entry: pattern.entry, nextIndex: chunkIndex };
  }

  return null;
}

function WordsToSign({
  words,
  setWords,
  signTokens,
  audio,
}: {
  words: string;
  setWords: (words: string) => void;
  signTokens: SignToken[];
  audio: ComputerAudioTranscriber;
}) {
  return (
    <div className="space-y-3">
      <Textarea
        value={words}
        onChange={(event) => setWords(event.target.value)}
        placeholder="Type words or phrases to sign"
        maxLength={160}
        className="min-h-18 resize-none border-border/70 bg-secondary/45 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/70"
      />

      <div className="phrase-dictionary" aria-label="Common phrases">
        <span className="dictionary-label">Quick phrases</span>
        <div className="phrase-list">
          {SIMPLE_PHRASES.map((phrase) => (
            <button
              key={phrase}
              className="phrase-chip"
              onClick={() => setWords(phrase)}
              type="button"
            >
              {phrase}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {audio.active ? (
          <button
            className="btn-stop"
            title="Stop computer audio transcription"
            onClick={audio.stop}
          >
            <Square className="size-4" /> Stop audio
          </button>
        ) : (
          <button
            className="btn-go"
            title="Translate computer audio into signs"
            onClick={audio.start}
          >
            <Volume2 className="size-4" /> Listen
          </button>
        )}
        <p className="text-[11px] leading-tight text-muted-foreground">
          {audio.active
            ? audio.transcribing
              ? "Transcribing the latest audio chunk."
              : "Listening to computer audio and updating the signs."
            : "Transcribes computer audio, then fingerspells it below."}
        </p>
      </div>

      {audio.error && (
        <p className="rounded-lg bg-destructive/15 px-3 py-2 text-xs text-destructive-foreground">
          {audio.error}
        </p>
      )}

      <div className="sign-strip">
        {signTokens.length ? (
          signTokens.map((token) => {
            if (token.kind === "break")
              return <div key={token.id} className="sign-break" />;
            if (token.kind === "space") {
              return (
                <div key={token.id} className="sign-space" aria-label="space">
                  space
                </div>
              );
            }
            if (token.kind === "punctuation") {
              return (
                <div
                  key={token.id}
                  className="sign-punctuation"
                  aria-label="punctuation"
                >
                  {token.character}
                </div>
              );
            }
            if (token.kind === "sign") {
              return (
                <figure
                  key={token.id}
                  className={`word-sign ${token.label.length > 12 ? "is-long" : ""}`}
                >
                  <div
                    className="word-sign__label"
                    aria-label={`${token.label} ASL sign`}
                  >
                    {token.label}
                  </div>
                  <figcaption>
                    <span>{token.cue}</span>
                    <div aria-label={`ASL gloss ${token.gloss}`}>
                      {token.gloss.split("-").map((part) => (
                        <b key={part}>{part}</b>
                      ))}
                    </div>
                  </figcaption>
                </figure>
              );
            }

            return (
              <figure key={token.id} className="sign-tile">
                <div
                  className="sign-glyph"
                  aria-label={`${token.character.toUpperCase()} in ASL`}
                >
                  {token.character.toUpperCase()}
                </div>
                <figcaption>{token.character.toUpperCase()}</figcaption>
              </figure>
            );
          })
        ) : (
          <p className="px-1 py-10 text-center text-sm text-muted-foreground">
            Type to show matching ASL hand signs.
          </p>
        )}
      </div>

      <p className="text-[11px] leading-tight text-muted-foreground">
        Common words render as whole ASL signs; unknown words fall back to the
        local fingerspelling font.
      </p>
    </div>
  );
}
