import { createFileRoute } from "@tanstack/react-router";
import { SignFramesInput } from "@/lib/sign.shared";

export const Route = createFileRoute("/api/interpret")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.json().catch(() => null);
        const parsed = SignFramesInput.safeParse(raw);
        if (!parsed.success) {
          return Response.json({ error: "Invalid frames payload" }, { status: 400 });
        }

        try {
          const { interpretFrames } = await import("@/lib/sign.server");
          const result = await interpretFrames(parsed.data);
          return Response.json(result);
        } catch (error) {
          console.error(error);
          const message = error instanceof Error ? error.message : "Interpretation failed";
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
