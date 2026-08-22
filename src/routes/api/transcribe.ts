import { createFileRoute } from "@tanstack/react-router";
import { AudioTranscriptionInput } from "@/lib/sign.shared";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.json().catch(() => null);
        const parsed = AudioTranscriptionInput.safeParse(raw);
        if (!parsed.success) {
          return Response.json({ error: "Invalid audio payload" }, { status: 400 });
        }

        try {
          const { transcribeAudio } = await import("@/lib/sign.server");
          const result = await transcribeAudio(parsed.data);
          return Response.json(result);
        } catch (error) {
          console.error(error);
          const message = error instanceof Error ? error.message : "Audio transcription failed";
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
