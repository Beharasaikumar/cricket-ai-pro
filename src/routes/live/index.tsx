import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, type Match } from "@/lib/api";

export const Route = createFileRoute("/live/")({
  component: () => <AppShell><LivePage /></AppShell>,
});

function LivePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  useEffect(() => { api<Match[]>("/api/matches").then(setMatches).catch(() => {}); }, []);

  const sections = [
    { label: "Live Now",   items: matches.filter(m => m.status === "live"),      status: "live" },
    { label: "Scheduled",  items: matches.filter(m => m.status === "scheduled"), status: "scheduled" },
    { label: "Completed",  items: matches.filter(m => m.status === "completed"), status: "completed" },
  ].filter(s => s.items.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      <div>
        <div style={labelStyle}>Matches</div>
        <h1 style={h1Style}>All Matches</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>
          {matches.length} total · {matches.filter(m => m.status === "live").length} live
        </p>
      </div>

      {matches.length === 0 && (
        <div style={{ background: "rgba(13,21,32,0.6)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 14, padding: "60px 24px", textAlign: "center", color: "#374151", fontSize: 14 }}>
          No matches yet. Create a tournament to generate fixtures.
        </div>
      )}

      {sections.map(({ label, items, status }) => (
        <section key={status}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#e2e8f0" }}>{label}</h2>
            <span style={{
              padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: status === "live" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)",
              color: status === "live" ? "#f87171" : "#6b7280",
              border: `1px solid ${status === "live" ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.08)"}`,
            }}>
              {items.length}
            </span>
          </div>
          <div style={{ background: "rgba(13,21,32,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
            {items.map(m => (
              <Link key={m.id} to="/live/$matchId" params={{ matchId: String(m.id) }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 20px", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{m.team_a_name} vs {m.team_b_name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{new Date(m.scheduled_at).toLocaleString()} · {m.venue}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {m.status !== "scheduled" && (
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                      {m.inn1_runs}/{m.inn1_wickets} · {m.inn2_runs}/{m.inn2_wickets}
                    </span>
                  )}
                  <StatusBadge status={m.status} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; border: string }> = {
    live:      { bg: "rgba(239,68,68,0.12)",   color: "#f87171",  border: "rgba(239,68,68,0.25)" },
    scheduled: { bg: "rgba(96,165,250,0.1)",   color: "#93c5fd",  border: "rgba(96,165,250,0.2)" },
    completed: { bg: "rgba(107,114,128,0.12)", color: "#9ca3af",  border: "rgba(107,114,128,0.2)" },
  };
  const c = cfg[status] ?? cfg.scheduled;
  return (
    <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {status}
    </span>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 6 };
const h1Style: React.CSSProperties = { margin: 0, fontSize: 34, fontWeight: 900, color: "#f0fdf4", letterSpacing: "-1px", fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase" };