import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

const channels = new Map<number, Set<WebSocket>>();

export function attachWs(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", "http://localhost");
    const matchId = Number(url.searchParams.get("matchId"));
    if (!matchId) { ws.close(); return; }
    if (!channels.has(matchId)) channels.set(matchId, new Set());
    channels.get(matchId)!.add(ws);
    ws.on("close", () => channels.get(matchId)?.delete(ws));
  });
}

export function broadcastScore(matchId: number, match: any) {
  const set = channels.get(matchId);
  if (!set) return;
  const msg = JSON.stringify({ type: "score", match });
  for (const ws of set) if (ws.readyState === ws.OPEN) ws.send(msg);
}
