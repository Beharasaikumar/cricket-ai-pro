import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, type Match } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/live")({
  component: () => (<AppShell><LivePage /></AppShell>),
});

function LivePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  useEffect(() => { api<Match[]>("/api/matches").then(setMatches).catch(() => {}); }, []);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Matches</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">All matches</h1>
      </div>
      <Card className="divide-y divide-border p-0">
        {matches.length === 0 && <div className="p-6 text-sm text-muted-foreground">No matches yet.</div>}
        {matches.map((m) => (
          <Link key={m.id} to="/live/$matchId" params={{ matchId: String(m.id) }} className="flex items-center justify-between p-4 hover:bg-accent">
            <div>
              <div className="text-sm font-medium">{m.team_a_name} vs {m.team_b_name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{new Date(m.scheduled_at).toLocaleString()} · {m.venue}</div>
            </div>
            <div className="flex items-center gap-4">
              {m.status !== "scheduled" && (
                <span className="font-mono text-sm tabular-nums">
                  {m.team_a_runs}/{m.team_a_wickets} · {m.team_b_runs}/{m.team_b_wickets}
                </span>
              )}
              <Badge variant={m.status === "live" ? "destructive" : m.status === "completed" ? "secondary" : "outline"}>{m.status}</Badge>
            </div>
          </Link>
        ))}
      </Card>
    </div>
  );
}
