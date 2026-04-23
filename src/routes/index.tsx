import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, type Match, type Tournament } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Trophy, Radio, Calendar, Layers, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: () => <AppShell><Dashboard /></AppShell>,
});

function Dashboard() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [err, setErr] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([
      api<Tournament[]>("/api/tournaments"),
      api<Match[]>("/api/matches"),
    ]).then(([t, m]) => { setTournaments(t); setMatches(m); })
      .catch(e => setErr(e.message));
  }, []);

  const live = matches.filter(m => m.status === "live");
  const upcoming = matches.filter(m => m.status === "scheduled").slice(0, 5);

  const stats = [
    { label: "Tournaments", value: tournaments.length, icon: Trophy, color: "#10b981" },
    { label: "Live Now",    value: live.length,         icon: Radio,  color: "#ef4444" },
    { label: "Scheduled",  value: matches.filter(m => m.status === "scheduled").length, icon: Calendar, color: "#60a5fa" },
    { label: "Total",      value: matches.length,       icon: Layers, color: "#a78bfa" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      {/* Hero */}
      <section>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 6 }}>Overview</div>
        <h1 style={{ margin: 0, fontSize: 38, fontWeight: 900, color: "#f0fdf4", letterSpacing: "-1.5px", fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase" }}>
          {user ? `Welcome, ${user.name.split(" ")[0]}` : "Tournament Command Center"}
        </h1>
        <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 14 }}>
          Schedule fixtures · track live scores · AI analysis
        </p>
        {err && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 9, fontSize: 13, color: "#fbbf24" }}>
            ⚠ Backend error: {err}
          </div>
        )}
      </section>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ background: "rgba(13,21,32,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},transparent)` }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px" }}>{label}</span>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={14} style={{ color }} />
              </div>
            </div>
            <div style={{ fontSize: 38, fontWeight: 900, color: "#f0fdf4", letterSpacing: "-1.5px", lineHeight: 1, marginTop: 10, fontFamily: "'Barlow Condensed',sans-serif" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Live */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#f0fdf4" }}>Live Now</h2>
            {live.length > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
                color: "#f87171", padding: "2px 10px", borderRadius: 20,
                fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 5px #ef4444", animation: "ping 1.5s infinite", display: "inline-block" }} />
                {live.length} LIVE
              </span>
            )}
          </div>
          <Link to="/live" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#10b981", textDecoration: "none", fontWeight: 700 }}>
            All matches <ArrowRight size={14} />
          </Link>
        </div>

        {live.length === 0 ? (
          <div style={{ background: "rgba(13,21,32,0.6)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 14, padding: "40px 24px", textAlign: "center", color: "#374151", fontSize: 14 }}>
            No live matches right now
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
            {live.map(m => (
              <Link key={m.id} to="/live/$matchId" params={{ matchId: String(m.id) }} style={{ textDecoration: "none" }}>
                <MatchCard m={m} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Bottom grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <section>
          <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: "#f0fdf4" }}>Upcoming Fixtures</h2>
          <Card>
            {upcoming.length === 0
              ? <Empty>No fixtures scheduled</Empty>
              : upcoming.map(m => (
                <Link key={m.id} to="/live/$matchId" params={{ matchId: String(m.id) }} style={rowLink}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#e2e8f0" }}>{m.team_a_name} vs {m.team_b_name}</div>
                    <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>{new Date(m.scheduled_at).toLocaleString()} · {m.venue}</div>
                  </div>
                  <StatusBadge status="scheduled" />
                </Link>
              ))}
          </Card>
        </section>

        <section>
          <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: "#f0fdf4" }}>Tournaments</h2>
          <Card>
            {tournaments.length === 0
              ? <Empty>No tournaments yet</Empty>
              : tournaments.slice(0, 5).map(t => (
                <Link key={t.id} to="/tournaments/$id" params={{ id: String(t.id) }} style={rowLink}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#e2e8f0" }}>{t.name}</div>
                    <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>{t.format} · {t.teams_count} teams</div>
                  </div>
                  <ArrowRight size={14} style={{ color: "#4b5563" }} />
                </Link>
              ))}
          </Card>
        </section>
      </div>
    </div>
  );
}

function MatchCard({ m }: { m: Match }) {
  return (
    <div style={{
      background: "rgba(13,21,32,0.9)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14, padding: 20, transition: "border-color 0.2s",
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
          color: "#f87171", padding: "2px 9px", borderRadius: 20,
          fontSize: 10, fontWeight: 700, textTransform: "uppercase",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ef4444", display: "inline-block", animation: "ping 1.5s infinite" }} />
          Live
        </span>
        <span style={{ fontSize: 11.5, color: "#4b5563" }}>{m.venue}</span>
      </div>
      {[
        { name: m.team_a_name, runs: m.inn1_runs, wkts: m.inn1_wickets, overs: m.inn1_overs },
        { name: m.team_b_name, runs: m.inn2_runs, wkts: m.inn2_wickets, overs: m.inn2_overs },
      ].map((team, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: i === 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{team.name}</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 700, color: "#f0fdf4" }}>
            {team.runs}/{team.wkts} <span style={{ color: "#6b7280", fontSize: 12 }}>({team.overs})</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "rgba(13,21,32,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "24px 20px", fontSize: 13, color: "#374151" }}>{children}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; border: string }> = {
    live:      { bg: "rgba(239,68,68,0.12)",  color: "#f87171",  border: "rgba(239,68,68,0.25)" },
    scheduled: { bg: "rgba(96,165,250,0.1)",  color: "#93c5fd",  border: "rgba(96,165,250,0.2)" },
    completed: { bg: "rgba(107,114,128,0.12)", color: "#9ca3af", border: "rgba(107,114,128,0.2)" },
  };
  const c = cfg[status] ?? cfg.scheduled;
  return (
    <span style={{ padding: "2px 9px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  );
}

const rowLink: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "13px 18px", textDecoration: "none",
  borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s",
};