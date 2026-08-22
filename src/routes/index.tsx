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
      { title: "Sign Overlay - Live Hand Sign Captions" },
      {
        name: "description",
        content:
          "A desktop overlay that watches your screen, recognizes hand signs locally, and speaks and captions the words in real time.",
      },
      { property: "og:title", content: "Sign Overlay - Live Hand Sign Captions" },
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
  return new URLSearchParams(window.location.search).has("dashboard") ? <Dashboard /> : <Overlay />;
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
  const signCharacters = useMemo(
    () =>
      [...words.slice(0, 80)].map((character, index) => ({
        id: `${character}-${index}`,
        character,
      })),
    [words],
  );

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
          ...(resize.size ? { width: resize.size.w, height: resize.size.h, maxWidth: "none" } : {}),
        }}
      >
        <header
          className="drag-region flex items-center gap-2 border-b border-border/60 px-4 py-2.5"
          style={{ cursor: drag.dragging ? "grabbing" : "grab" }}
          onPointerDown={drag.onPointerDown}
          onPointerEnter={restoreInteraction}
          onDoubleClick={() => drag.reset()}
        >
          <span className={`pulse-dot ${reader.active || audio.active ? "is-live" : ""}`} />
          <img className="overlay-brandmark" src={signifyBasicBrandmarkUrl} alt="" />
          <h1 className="text-sm font-semibold tracking-tight">Sign Overlay</h1>

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
                  updateSettings({ mode: checked ? "words-to-sign" : "sign-to-words" })
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
                {voiceOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
              </button>
            )}
            <button
              className="ctl"
              title="Cycle translucency"
              onClick={() => {
                const current = TRANSLUCENCY.findIndex((step) => Math.abs(step - alpha) < 0.02);
                const next = TRANSLUCENCY[(current + 1) % TRANSLUCENCY.length] ?? TRANSLUCENCY[0];
                updateSettings({ opacity: Math.round(next * 100) });
              }}
            >
              <Contrast className="size-4" />
            </button>
            {mode === "sign-to-words" ? (
              <button className="ctl" title="Clear transcript" onClick={reader.clear}>
                <Trash2 className="size-4" />
              </button>
            ) : (
              <button className="ctl" title="Clear words" onClick={() => setWords("")}>
                <Trash2 className="size-4" />
              </button>
            )}
            {inShell && (
              <>
                <button
                  className={`ctl ${ghost ? "is-on" : ""}`}
                  title={ghost ? "Disable click-through mode" : "Enable click-through mode"}
                  onClick={async () => setGhost(await window.overlay!.toggleClickThrough())}
                >
                  <Ghost className="size-4" />
                </button>
                <button
                  className="ctl"
                  title="Hide overlay"
                  onClick={() => void window.overlay!.setOverlayVisible?.(false)}
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
              signCharacters={signCharacters}
              audio={audio}
            />
          )}
        </div>

        <div className="no-drag grip" title="Drag to resize" onPointerDown={resize.onPointerDown} />
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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const transcriptRef = useRef("");
  const busyRef = useRef(false);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
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
        const result = (await response.json()) as { text?: string; error?: string };
        if (!response.ok)
          throw new Error(result.error ?? `Transcription failed (${response.status})`);

        const text = result.text?.trim();
        if (text) {
          transcriptRef.current = `${transcriptRef.current} ${text}`.trim().slice(-1200);
          setWords(transcriptRef.current.slice(-80));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Audio transcription failed");
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

      stream.getTracks().forEach((track) => track.addEventListener("ended", stop));

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
      setError(err instanceof Error ? err.message : "Could not start computer audio capture");
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
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
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
  const attach = (recorder: MediaRecorder) => {
    recorder.addEventListener("dataavailable", onData);
    recorder.addEventListener("stop", onStop);
    return recorder;
  };

  const recorder = attach(createAudioRecorder(stream));
  try {
    recorder.start(AUDIO_CHUNK_MS);
    return recorder;
  } catch {
    recorder.removeEventListener("dataavailable", onData);
    recorder.removeEventListener("stop", onStop);
  }

  const fallback = attach(createAudioRecorder(stream, true));
  fallback.start(AUDIO_CHUNK_MS);
  return fallback;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read audio"));
    reader.readAsDataURL(blob);
  });
}

function SignToWords({ reader, history }: { reader: SignReader; history: SignReader["phrases"] }) {
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
          Sends short screen-frame bursts to Google Gemini for ASL letter and phrase recognition,
          then speaks the result aloud.
        </p>
      </div>
    </>
  );
}

type SignCharacter = {
  id: string;
  character: string;
};

const SIMPLE_PHRASES = ["hi", "hello", "I'm fine", "okay", "why", "time"];

function WordsToSign({
  words,
  setWords,
  signCharacters,
  audio,
}: {
  words: string;
  setWords: (words: string) => void;
  signCharacters: SignCharacter[];
  audio: ComputerAudioTranscriber;
}) {
  return (
    <div className="space-y-3">
      <Textarea
        value={words}
        onChange={(event) => setWords(event.target.value)}
        placeholder="Type words to fingerspell"
        maxLength={80}
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
        {signCharacters.length ? (
          signCharacters.map(({ id, character }) =>
            character === "\n" ? (
              <div key={id} className="sign-break" />
            ) : character === " " || character === "\t" ? (
              <div key={id} className="sign-space" aria-label="space">
                space
              </div>
            ) : (
              <figure key={id} className="sign-tile">
                <div className="sign-glyph" aria-label={`${character.toUpperCase()} in ASL`}>
                  {character.toUpperCase()}
                </div>
                <figcaption>{character.toUpperCase()}</figcaption>
              </figure>
            ),
          )
        ) : (
          <p className="px-1 py-10 text-center text-sm text-muted-foreground">
            Type to show matching ASL hand signs.
          </p>
        )}
      </div>

      <p className="text-[11px] leading-tight text-muted-foreground">
        Uses the local Gallaudet fingerspelling font for consistent ASL alphabet signs.
      </p>
    </div>
  );
}
