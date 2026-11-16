import { NextRequest } from "next/server";
import { realtimeHub } from "@/lib/realtime-hub";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId =
    searchParams.get("clientId") ||
    `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        if (closed) return;
        try {
          const line = `data: ${JSON.stringify({ event, data: payload })}\n\n`;
          controller.enqueue(encoder.encode(line));
        } catch {
          closed = true;
        }
      };

      realtimeHub.registerClient(clientId, send);
      send("connected", { clientId });

      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, 20_000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        realtimeHub.unregisterClient(clientId);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      realtimeHub.unregisterClient(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.clientId || !body.event) {
    return new Response(JSON.stringify({ error: "Invalid realtime payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  realtimeHub.handleEvent(body.clientId, body.event, body.data);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
