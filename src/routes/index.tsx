import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, type Match, type Tournament } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Trophy, Radio, Calendar, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: () => (<AppShell><Dashboard /></AppShell>),
});

function Dashboard() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([api<Tournament[]>("/api/tournaments"), api<Match[]>("/api/matches")])
      .then(([t, m]) => { setTournaments(t); setMatches(m); })
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches.filter((m) => m.status === "scheduled").slice(0, 4);

  const stats = [
    { label: "Tournaments", value: tournaments.length, icon: Trophy },
    { label: "Live Matches", value: live.length, icon: Radio },
    { label: "Scheduled", value: matches.filter((m) => m.status === "scheduled").length, icon: Calendar },
    { label: "Total Matches", value: matches.length, icon: Users },
  ];

  return (
    <div className="space-y-10">
      <section>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Overview</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Tournament command center</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Schedule fixtures, track live scores in real time, and generate AI match analysis with one click.
        </p>
        {err && (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Backend not reachable: {err}. Make sure the Express server in <code>backend/</code> is running on port 4000.
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="border-border p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight">{s.value}</div>
            </Card>
          );
        })}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Live now</h2>
            <p className="text-sm text-muted-foreground">Real-time scores via WebSocket</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/live">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        </div>
        {live.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No live matches right now.</Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {live.map((m) => (
              <Link key={m.id} to="/live/$matchId" params={{ matchId: String(m.id) }}>
                <Card className="group border-border p-5 transition-colors hover:border-foreground">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wider text-destructive">Live</span>
                    <span className="ml-auto text-xs text-muted-foreground">{m.venue}</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Row name={m.team_a_name || `Team ${m.team_a_id}`} runs={m.team_a_runs} wkts={m.team_a_wickets} overs={m.team_a_overs} />
                    <Row name={m.team_b_name || `Team ${m.team_b_id}`} runs={m.team_b_runs} wkts={m.team_b_wickets} overs={m.team_b_overs} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">Upcoming fixtures</h2>
          <Card className="divide-y divide-border p-0">
            {upcoming.length === 0 && <div className="p-6 text-sm text-muted-foreground">No fixtures scheduled.</div>}
            {upcoming.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="text-sm font-medium">{m.team_a_name} vs {m.team_b_name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(m.scheduled_at).toLocaleString()} · {m.venue}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>
        <div>
          <h2 className="mb-4 text-xl font-semibold tracking-tight">Tournaments</h2>
          <Card className="divide-y divide-border p-0">
            {tournaments.length === 0 && <div className="p-6 text-sm text-muted-foreground">No tournaments yet.</div>}
            {tournaments.map((t) => (
              <Link key={t.id} to="/tournaments/$id" params={{ id: String(t.id) }} className="flex items-center justify-between p-4 hover:bg-accent">
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.format} · {t.teams_count} teams</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </Card>
        </div>
      </section>
    </div>
  );
}

function Row({ name, runs, wkts, overs }: { name: string; runs: number; wkts: number; overs: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">{name}</span>
      <span className="font-mono text-sm tabular-nums">{runs}/{wkts} <span className="text-muted-foreground">({overs})</span></span>
    </div>
  );
}
