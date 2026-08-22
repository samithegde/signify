import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Ghost, Hand, Mic, MicOff, Play, Square, Trash2, X } from "lucide-react";
import { useSignReader } from "@/lib/useSignReader";
import { useOverlayDrag } from "@/lib/useOverlayDrag";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign Overlay — Live AI Sign Language Captions" },
      {
        name: "description",
        content:
          "A desktop overlay that watches your screen, reads sign language with AI, and speaks and captions the words in real time.",
      },
      { property: "og:title", content: "Sign Overlay — Live AI Sign Language Captions" },
      {
        property: "og:description",
        content:
          "Reads sign language from anything on your screen and turns it into spoken words and live captions.",
      },
    ],
  }),
  component: Overlay,
});

declare global {
  interface Window {
    overlay?: {
      isElectron: boolean;
      toggleClickThrough: () => Promise<boolean>;
      quit: () => Promise<void>;
      dragStart?: () => Promise<void>;
      dragEnd?: () => Promise<void>;
      resizeStart?: () => Promise<void>;
      resizeEnd?: () => Promise<void>;
    };
  }
}

const TRANSLUCENCY = [0.42, 0.68, 0.9];

function Overlay() {
  const reader = useSignReader();
  const drag = useOverlayDrag();
  const resize = useOverlayResize();
  const [ghost, setGhost] = useState(false);
  const [inShell, setInShell] = useState(false);
  const [alphaStep, setAlphaStep] = useState(1);

  useEffect(() => setInShell(Boolean(window.overlay?.isElectron)), []);

  const history = reader.phrases.slice(0, -1).slice(-6);
  const alpha = TRANSLUCENCY[alphaStep];

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
          onDoubleClick={() => drag.reset()}
        >

          <span className={`pulse-dot ${reader.active ? "is-live" : ""}`} />
          <Hand className="size-4 text-accent" />
          <h1 className="text-sm font-semibold tracking-tight">Sign Overlay</h1>

          <span className="text-[11px] text-muted-foreground">
            {reader.active
              ? reader.thinking
                ? "reading signs…"
                : "watching your screen"
              : "idle"}
          </span>

          <div className="no-drag ml-auto flex items-center gap-1">
            <button
              className="ctl"
              title={reader.voiceOn ? "Mute voice" : "Unmute voice"}
              onClick={() => reader.setVoiceOn(!reader.voiceOn)}
            >
              {reader.voiceOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
            </button>
            <button className="ctl" title="Clear transcript" onClick={reader.clear}>
              <Trash2 className="size-4" />
            </button>
            {inShell && (
              <>
                <button
                  className={`ctl ${ghost ? "is-on" : ""}`}
                  title="Click-through mode"
                  onClick={async () => setGhost(await window.overlay!.toggleClickThrough())}
                >
                  <Ghost className="size-4" />
                </button>
                <button className="ctl" title="Quit" onClick={() => window.overlay!.quit()}>
                  <X className="size-4" />
                </button>
              </>
            )}
          </div>
        </header>

        <div className="no-drag px-5 py-4">
          <div className="min-h-[92px]">
            {history.length > 0 && (
              <p className="mb-2 line-clamp-2 text-sm leading-snug text-muted-foreground">
                {history.map((phrase) => phrase.text).join(" ")}
              </p>
            )}
            <p className="caption text-2xl leading-tight font-semibold">
              {reader.latest?.text ??
                (reader.active
                  ? "Point me at someone signing…"
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
              <button className="btn-stop" onClick={reader.stop}>
                <Square className="size-4" /> Stop
              </button>
            ) : (
              <button className="btn-go" onClick={reader.start}>
                <Play className="size-4" /> Start reading
              </button>
            )}
            <p className="text-[11px] leading-tight text-muted-foreground">
              Captures a burst of screen frames every few seconds, interprets the signing with AI,
              then speaks it aloud.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
