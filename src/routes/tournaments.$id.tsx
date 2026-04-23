import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, type Player, type Match, type Team, type Tournament, type Standing } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Pencil, Check, X, Trophy, Calendar, BarChart2, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tournaments/$id")({
  component: () => <AppShell><TournamentDetail /></AppShell>,
});

type Tab = "schedule" | "standings" | "players";

function TournamentDetail() {
  const { id } = Route.useParams();
  const { isAdmin, canScore } = useAuth();

  const [t, setT]                 = useState<Tournament | null>(null);
  const [teams, setTeams]         = useState<Team[]>([]);
  const [matches, setMatches]     = useState<Match[]>([]);
  const [players, setPlayers]     = useState<Player[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [tab, setTab]             = useState<Tab>("schedule");
  const [loading, setLoading]     = useState(true);

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingId, setSavingId]   = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<Tournament>(`/api/tournaments/${id}`),
      api<Team[]>(`/api/tournaments/${id}/teams`),
      api<Match[]>(`/api/tournaments/${id}/matches`),
      api<Player[]>(`/api/tournaments/${id}/players`),
      api<Standing[]>(`/api/tournaments/${id}/standings`),
    ]).then(([tData, teamsData, matchesData, playersData, standingsData]) => {
      setT(tData);
      setTeams(teamsData);
      setMatches(matchesData);
      setPlayers(playersData);
      setStandings(standingsData);
    }).catch(e => toast.error("Failed to load: " + e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const startEdit = (p: Player) => { setEditingId(p.id); setDraftName(p.name); };
  const cancelEdit = () => { setEditingId(null); setDraftName(""); };

  const savePlayer = async (playerId: number) => {
    if (!draftName.trim()) return;
    setSavingId(playerId);
    try {
      await api(`/api/tournaments/players/${playerId}`, { method: "PUT", body: JSON.stringify({ name: draftName.trim() }) });
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, name: draftName.trim() } : p));
      setEditingId(null);
      toast.success("Player name saved");
    } catch { toast.error("Failed to save"); }
    finally { setSavingId(null); }
  };

  const deletePlayer = async (playerId: number) => {
    try {
      await api(`/api/tournaments/players/${playerId}`, { method: "DELETE" });
      setPlayers(prev => prev.filter(p => p.id !== playerId));
      toast.success("Player removed");
    } catch { toast.error("Failed to delete"); }
  };

  const grouped = players.reduce((acc, p) => {
    (acc[p.team_name] ??= []).push(p);
    return acc;
  }, {} as Record<string, Player[]>);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#6b7280", gap: 10 }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #10b981", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
      Loading tournament…
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!t) return (
    <div style={{ textAlign: "center", padding: 40, color: "#f87171" }}>
      Tournament not found. <Link to="/tournaments" style={{ color: "#10b981" }}>Go back</Link>
    </div>
  );

  const completed = matches.filter(m => m.status === "completed").length;
  const live = matches.filter(m => m.status === "live").length;

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: "schedule",  label: "Schedule",     icon: Calendar,  count: matches.length },
    { key: "standings", label: "Points Table", icon: BarChart2, count: standings.length },
    { key: "players",   label: "Players",      icon: Users,     count: players.length },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── HEADER ── */}
      <div>
        <Link to="/tournaments" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#6b7280", textDecoration: "none", marginBottom: 14, transition: "color 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#e2e8f0")}
          onMouseLeave={e => (e.currentTarget.style.color = "#6b7280")}
        >
          <ArrowLeft size={13} /> All Tournaments
        </Link>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 4 }}>
              {t.format} Tournament
            </div>
            <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 900, color: "#f0fdf4", letterSpacing: "-1px", fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase", lineHeight: 1 }}>
              {t.name}
            </h1>
            <div style={{ fontSize: 13, color: "#6b7280", display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
              <span>{t.teams_count} teams</span>
              <span>·</span>
              <span>Started {new Date(t.start_date).toLocaleDateString()}</span>
              <span>·</span>
              <span style={{ color: live > 0 ? "#f87171" : "#6b7280" }}>
                {live > 0 ? `${live} live` : `${completed}/${matches.length} played`}
              </span>
            </div>
          </div>

          {/* Quick stat pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatPill label="Matches" value={matches.length} color="#60a5fa" />
            <StatPill label="Completed" value={completed} color="#10b981" />
            {live > 0 && <StatPill label="Live" value={live} color="#ef4444" />}
          </div>
        </div>

        {/* Team badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 16 }}>
          {teams.map(tm => (
            <span key={tm.id} style={{ padding: "3px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}>
              {tm.name}
            </span>
          ))}
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, alignSelf: "flex-start", gap: 2 }}>
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 16px", borderRadius: 9, border: "none",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            transition: "all 0.15s", fontFamily: "'Barlow',sans-serif",
            background: tab === key ? "#10b981" : "transparent",
            color: tab === key ? "white" : "#6b7280",
            boxShadow: tab === key ? "0 2px 8px rgba(16,185,129,0.3)" : "none",
            whiteSpace: "nowrap",
          }}>
            <Icon size={13} />
            {label}
            {count !== undefined && (
              <span style={{ padding: "1px 6px", borderRadius: 10, fontSize: 10, fontWeight: 800, background: tab === key ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)", color: tab === key ? "white" : "#6b7280" }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── SCHEDULE TAB ── */}
      {tab === "schedule" && (
        <div style={tableCard}>
          {matches.length === 0 ? (
            <EmptyState icon={<Calendar size={28} />} message="No matches scheduled for this tournament" />
          ) : (
            <>
              {(["live", "scheduled", "completed"] as const).map(status => {
                const group = matches.filter(m => m.status === status);
                if (group.length === 0) return null;
                const statusLabel = status === "live" ? "🔴 Live Now" : status === "scheduled" ? "📅 Upcoming" : "✅ Completed";
                return (
                  <div key={status}>
                    <div style={{ padding: "10px 20px 8px", fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "1.2px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 8 }}>
                      {statusLabel}
                      <span style={{ color: "#374151", fontWeight: 400 }}>— {group.length} match{group.length !== 1 ? "es" : ""}</span>
                    </div>
                    {group.map(m => (
                      <Link
                        key={m.id}
                        to="/live/$matchId"
                        params={{ matchId: String(m.id) }}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>
                            {m.team_a_name} <span style={{ color: "#4b5563" }}>vs</span> {m.team_b_name}
                          </div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                            {new Date(m.scheduled_at).toLocaleString()} · {m.venue}
                          </div>
                          {/* Show scores for live/completed matches */}
                          {m.status !== "scheduled" && (
                            <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                              <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#e2e8f0" }}>
                                {m.team_a_name.split(" ")[0]}: <span style={{ color: "#f0fdf4" }}>{m.inn1_runs}/{m.inn1_wickets}</span>
                                <span style={{ color: "#6b7280", fontWeight: 400 }}> ({m.inn1_overs} ov)</span>
                              </div>
                              <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "#e2e8f0" }}>
                                {m.team_b_name.split(" ")[0]}: <span style={{ color: "#f0fdf4" }}>{m.inn2_runs}/{m.inn2_wickets}</span>
                                <span style={{ color: "#6b7280", fontWeight: 400 }}> ({m.inn2_overs} ov)</span>
                              </div>
                              {/* Winner callout */}
                              {m.status === "completed" && m.winner_id && (
                                <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                                  <Trophy size={10} /> {m.winner_id === m.team_a_id ? m.team_a_name : m.team_b_name} won
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <StatusBadge status={m.status} />
                      </Link>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ── STANDINGS TAB ── */}
      {tab === "standings" && (
        <div>
          {standings.length === 0 ? (
            <div style={tableCard}>
              <EmptyState icon={<BarChart2 size={28} />} message="Standings appear after matches are completed" />
            </div>
          ) : (
            <>
              {/* Top 3 podium cards */}
              {standings.length >= 2 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 20 }}>
                  {standings.slice(0, Math.min(3, standings.length)).map((s, i) => {
                    const medals = ["🥇", "🥈", "🥉"];
                    const colors = ["#f59e0b", "#9ca3af", "#b45309"];
                    return (
                      <div key={s.id} style={{ background: "rgba(13,21,32,0.9)", border: `1px solid ${colors[i]}30`, borderRadius: 14, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${colors[i]},transparent)` }} />
                        <div style={{ fontSize: 22, marginBottom: 8 }}>{medals[i]}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#f0fdf4" }}>{s.name}</div>
                        <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 12 }}>
                          <span style={{ color: "#10b981", fontWeight: 700 }}>{s.won}W</span>
                          <span style={{ color: "#f87171" }}>{s.lost}L</span>
                          <span style={{ color: colors[i], fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>{s.points} pts</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Full table */}
              <div style={tableCard}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["#", "Team", "P", "W", "L", "T", "NRR", "Pts"].map((h, hi) => (
                        <th key={h} style={{ padding: "10px 16px", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#6b7280", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: hi < 2 ? "left" : "center" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ width: 26, height: 26, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, background: i === 0 ? "rgba(245,158,11,0.18)" : i === 1 ? "rgba(156,163,175,0.12)" : i === 2 ? "rgba(180,83,9,0.12)" : "rgba(255,255,255,0.05)", color: i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : i === 2 ? "#b45309" : "#6b7280" }}>
                            {i + 1}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "#e2e8f0", fontSize: 14 }}>{s.name}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>{s.played}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center", color: "#10b981", fontWeight: 700, fontSize: 13 }}>{s.won}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center", color: "#f87171", fontSize: 13 }}>{s.lost}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center", color: "#6b7280", fontSize: 13 }}>{s.tied}</td>
                        <td style={{ padding: "12px 16px", textAlign: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: s.nrr > 0 ? "#10b981" : s.nrr < 0 ? "#f87171" : "#9ca3af" }}>
                          {s.nrr > 0 ? "+" : ""}{s.nrr.toFixed(3)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <span style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 6, padding: "3px 12px", fontSize: 15, fontWeight: 900, fontFamily: "'JetBrains Mono',monospace" }}>
                            {s.points}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PLAYERS TAB ── */}
      {tab === "players" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Role hint banner */}
          {!canScore && (
            <div style={{ padding: "10px 16px", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 10, fontSize: 13, color: "#93c5fd" }}>
              You're viewing as <strong>Viewer</strong> — Admins and Scorers can rename players.
            </div>
          )}
          {canScore && (
            <div style={{ padding: "10px 16px", background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, fontSize: 13, color: "#6ee7b7" }}>
              Click the <strong>✏️ pencil icon</strong> to rename a player · Press Enter to save · Esc to cancel
            </div>
          )}

          {players.length === 0 ? (
            <div style={tableCard}>
              <EmptyState icon={<Users size={28} />} message="No players found for this tournament" />
            </div>
          ) : (
            Object.entries(grouped).map(([teamName, teamPlayers]) => (
              <div key={teamName}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#e2e8f0" }}>{teamName}</h3>
                  <span style={{ fontSize: 11, color: "#6b7280", background: "rgba(255,255,255,0.06)", padding: "2px 9px", borderRadius: 20, fontWeight: 600 }}>
                    {teamPlayers.length} players
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 8 }}>
                  {teamPlayers.map(p => {
                    const isEditing = editingId === p.id;
                    return (
                      <div key={p.id} style={{
                        background: isEditing ? "rgba(16,185,129,0.06)" : "rgba(13,21,32,0.9)",
                        border: `1px solid ${isEditing ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.07)"}`,
                        borderRadius: 11, padding: "10px 13px",
                        display: "flex", alignItems: "center", gap: 10,
                        transition: "all 0.15s",
                      }}>
                        {/* Avatar */}
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: isEditing ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                          {(isEditing ? draftName : p.name)[0]?.toUpperCase() || "?"}
                        </div>

                        {/* Name — editable inline */}
                        {isEditing ? (
                          <input
                            autoFocus
                            value={draftName}
                            onChange={e => setDraftName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") savePlayer(p.id); if (e.key === "Escape") cancelEdit(); }}
                            style={{ flex: 1, padding: "5px 9px", borderRadius: 7, border: "1px solid rgba(16,185,129,0.4)", background: "rgba(16,185,129,0.08)", color: "#f0fdf4", fontSize: 13, outline: "none", fontFamily: "'Barlow',sans-serif" }}
                          />
                        ) : (
                          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.name}
                          </span>
                        )}

                        {/* Edit/Save/Cancel/Delete buttons */}
                        {isEditing ? (
                          <>
                            <button
                              disabled={savingId === p.id || !draftName.trim()}
                              onClick={() => savePlayer(p.id)}
                              title="Save (Enter)"
                              style={{ ...iconBtn, color: "#10b981", border: "1px solid rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.1)" }}
                            >
                              {savingId === p.id ? <span style={{ fontSize: 10 }}>…</span> : <Check size={13} />}
                            </button>
                            <button onClick={cancelEdit} title="Cancel (Esc)" style={{ ...iconBtn, color: "#9ca3af" }}>
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            {canScore && (
                              <button
                                onClick={() => startEdit(p)}
                                title="Edit player name"
                                style={{ ...iconBtn, color: "#4b5563" }}
                                onMouseEnter={e => { e.currentTarget.style.color = "#e2e8f0"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                                onMouseLeave={e => { e.currentTarget.style.color = "#4b5563"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                              >
                                <Pencil size={12} />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => deletePlayer(p.id)}
                                title="Remove player"
                                style={{ ...iconBtn, color: "#4b5563" }}
                                onMouseEnter={e => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.25)"; }}
                                onMouseLeave={e => { e.currentTarget.style.color = "#4b5563"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: "6px 14px", borderRadius: 20, background: `${color}12`, border: `1px solid ${color}25`, textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 900, color, fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 1 }}>{label}</div>
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
    <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: "nowrap", marginLeft: 12 }}>
      {status}
    </span>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div style={{ padding: "50px 24px", textAlign: "center" }}>
      <div style={{ color: "#1f2937", marginBottom: 10, display: "flex", justifyContent: "center" }}>{icon}</div>
      <p style={{ color: "#374151", fontSize: 14, margin: 0 }}>{message}</p>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const tableCard: React.CSSProperties = {
  background: "rgba(13,21,32,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden",
};
const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0, transition: "all 0.15s", padding: 0,
};