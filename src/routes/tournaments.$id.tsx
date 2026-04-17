import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, type Match, type Team, type Tournament } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tournaments/$id")({
  component: () => (<AppShell><TournamentDetail /></AppShell>),
});

function TournamentDetail() {
  const { id } = Route.useParams();
  const [t, setT] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    api<Tournament>(`/api/tournaments/${id}`).then(setT).catch(() => {});
    api<Team[]>(`/api/tournaments/${id}/teams`).then(setTeams).catch(() => {});
    api<Match[]>(`/api/tournaments/${id}/matches`).then(setMatches).catch(() => {});
  }, [id]);

  if (!t) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/tournaments"><ArrowLeft className="mr-1 h-4 w-4" /> Back</Link>
        </Button>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t.format}</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{t.name}</h1>
        <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
          <span>{t.teams_count} teams</span>
          <span>·</span>
          <span>Starts {new Date(t.start_date).toLocaleDateString()}</span>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Teams</h2>
        <div className="flex flex-wrap gap-2">
          {teams.map((tm) => (
            <Badge key={tm.id} variant="secondary" className="px-3 py-1.5 text-sm font-medium">{tm.name}</Badge>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Schedule</h2>
        <Card className="divide-y divide-border p-0">
          {matches.map((m) => (
            <Link key={m.id} to="/live/$matchId" params={{ matchId: String(m.id) }} className="flex items-center justify-between p-4 hover:bg-accent">
              <div className="flex items-center gap-4">
                <div className="font-mono text-xs text-muted-foreground">#{m.id}</div>
                <div>
                  <div className="text-sm font-medium">{m.team_a_name} vs {m.team_b_name}</div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(m.scheduled_at).toLocaleString()}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {m.venue}</span>
                  </div>
                </div>
              </div>
              <Badge variant={m.status === "live" ? "destructive" : m.status === "completed" ? "secondary" : "outline"}>
                {m.status}
              </Badge>
            </Link>
          ))}
        </Card>
      </section>
    </div>
  );
}
