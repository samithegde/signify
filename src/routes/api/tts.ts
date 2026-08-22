import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        return new Response("Speech is provided locally by the browser", { status: 501 });
      },
    },
  },
});
