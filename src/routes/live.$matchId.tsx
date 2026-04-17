import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, WS_URL, type Match } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/live/$matchId")({
  component: () => (<AppShell><LiveMatch /></AppShell>),
});

function LiveMatch() {
  const { matchId } = Route.useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    api<Match>(`/api/matches/${matchId}`).then(setMatch).catch(() => {});
    const ws = new WebSocket(`${WS_URL}/ws?matchId=${matchId}`);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "score") setMatch((m) => (m ? { ...m, ...data.match } : data.match));
      } catch {}
    };
    wsRef.current = ws;
    return () => { ws.close(); };
  }, [matchId]);

  const startMatch = async () => {
    await api(`/api/matches/${matchId}/start`, { method: "POST" });
    toast.success("Match started");
  };

  const addRuns = async (team: "a" | "b", runs: number, wicket = false) => {
    await api(`/api/matches/${matchId}/score`, {
      method: "POST",
      body: JSON.stringify({ team, runs, wicket, balls: 1 }),
    });
  };

  const finishMatch = async () => {
    await api(`/api/matches/${matchId}/complete`, { method: "POST" });
    toast.success("Match completed");
  };

  const getAnalysis = async () => {
    setLoadingAi(true);
    try {
      const res = await api<{ analysis: string }>(`/api/matches/${matchId}/analysis`, { method: "POST" });
      setAnalysis(res.analysis);
    } catch (e: any) {
      toast.error(e.message || "AI analysis failed");
    } finally { setLoadingAi(false); }
  };

  if (!match) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/live"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
      </Button>

      <div className="flex items-center gap-3">
        {match.status === "live" && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
          </span>
        )}
        <Badge variant={match.status === "live" ? "destructive" : match.status === "completed" ? "secondary" : "outline"}>
          {match.status}
        </Badge>
        <span className="text-sm text-muted-foreground">{match.venue}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ScoreCard name={match.team_a_name || "Team A"} runs={match.team_a_runs} wkts={match.team_a_wickets} overs={match.team_a_overs} />
        <ScoreCard name={match.team_b_name || "Team B"} runs={match.team_b_runs} wkts={match.team_b_wickets} overs={match.team_b_overs} />
      </div>

      {match.status === "scheduled" && (
        <Button onClick={startMatch}>Start match</Button>
      )}

      {match.status === "live" && (
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Score updates</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {(["a", "b"] as const).map((side) => (
              <div key={side} className="space-y-2">
                <p className="text-sm font-medium">{side === "a" ? match.team_a_name : match.team_b_name}</p>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 6].map((r) => (
                    <Button key={r} size="sm" variant="outline" onClick={() => addRuns(side, r)}>
                      <Plus className="mr-0.5 h-3 w-3" />{r}
                    </Button>
                  ))}
                  <Button size="sm" variant="destructive" onClick={() => addRuns(side, 0, true)}>Wicket</Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="secondary" onClick={finishMatch}>Complete match</Button>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight">AI Match Analysis</h3>
            <p className="text-sm text-muted-foreground">Powered by Groq · llama-3.1-8b-instant</p>
          </div>
          <Button onClick={getAnalysis} disabled={loadingAi}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            {loadingAi ? "Analyzing…" : "Generate"}
          </Button>
        </div>
        {analysis && (
          <div className="mt-5 whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 text-sm leading-relaxed">
            {analysis}
          </div>
        )}
      </Card>
    </div>
  );
}

function ScoreCard({ name, runs, wkts, overs }: { name: string; runs: number; wkts: number; overs: number }) {
  return (
    <Card className="p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{name}</p>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="font-mono text-5xl font-semibold tabular-nums tracking-tight">{runs}</span>
        <span className="font-mono text-2xl text-muted-foreground">/{wkts}</span>
      </div>
      <p className="mt-2 font-mono text-sm text-muted-foreground">{overs} overs</p>
    </Card>
  );
}
