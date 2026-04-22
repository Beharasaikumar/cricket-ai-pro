import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, WS_URL, type Match, type BallEvent, type PlayerStat } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  ArrowLeft, Play, CheckCircle, Sparkles,
  Shield, Zap, BarChart3, ListOrdered, Radio,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";

export const Route = createFileRoute("/live/$matchId")({
  component: () => <AppShell><LiveMatch /></AppShell>,
});

type Tab = "scoring" | "scorecard" | "stats";
type Innings = 1 | 2; // 1 = Team A bats, 2 = Team B bats

// ─── Main Component ──────────────────────────────────────────────────────────
function LiveMatch() {
  const { matchId } = Route.useParams();
  const { canScore } = useAuth();

  const [match,     setMatch]    = useState<Match | null>(null);
  const [events,    setEvents]   = useState<BallEvent[]>([]);
  const [players,   setPlayers]  = useState<PlayerStat[]>([]);
  const [analysis,  setAnalysis] = useState("");
  const [aiLoading, setAiLoad]   = useState(false);
  const [tab,       setTab]      = useState<Tab>("scoring");

  // Innings tracking: 1 = team A batting, 2 = team B batting
  const [innings, setInnings]       = useState<Innings>(1);
  const [inn1Done, setInn1Done]     = useState(false); // team A innings completed

  // Current ball selectors — reset when innings changes
  const [batsmanId, setBatsmanId] = useState<number | "">("");
  const [bowlerId,  setBowlerId]  = useState<number | "">("");

  const wsRef = useRef<WebSocket | null>(null);

  const refresh = async () => {
    const [e, p] = await Promise.all([
      api<BallEvent[]>(`/api/matches/${matchId}/scorecard`),
      api<PlayerStat[]>(`/api/matches/${matchId}/player-stats`),
    ]);
    setEvents(e); setPlayers(p);
  };

  useEffect(() => {
    api<Match>(`/api/matches/${matchId}`).then(m => {
      setMatch(m);
      if (m.team_a_wickets >= 10) { setInn1Done(true); setInnings(2); }
      if (m.team_b_wickets >= 10) setInnings(2);
    });
    refresh();
  }, [matchId]);

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws?matchId=${matchId}`);
    ws.onmessage = async ev => {
      try {
        const d = JSON.parse(ev.data);
        if (d.type === "score") { setMatch(d.match); await refresh(); }
      } catch {}
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [matchId]);

  const startMatch = async () => {
    try {
      await api(`/api/matches/${matchId}/start`, { method: "POST" });
      setInnings(1); setInn1Done(false);
      toast.success("Match started! Team A bats first.");
    } catch (e: any) { toast.error(e.message); }
  };

  const endInnings1 = () => {
    setInn1Done(true);
    setInnings(2);
    setBatsmanId(""); setBowlerId("");
    toast.success(`Innings 1 done. ${match?.team_b_name} now bats!`);
  };

  const addBall = async (runs: number, wicket = false) => {
    if (!batsmanId) { toast.error("Select a batsman first"); return; }
    if (!bowlerId)  { toast.error("Select a bowler first");  return; }

    const battingWkts = innings === 1 ? match!.team_a_wickets : match!.team_b_wickets;
    if (battingWkts >= 10) { toast.error("This team is ALL OUT"); return; }

    const newWkts = battingWkts + (wicket ? 1 : 0);

    try {
      await api(`/api/matches/${matchId}/score`, {
        method: "POST",
        body: JSON.stringify({
          team: innings === 1 ? "a" : "b",
          runs, wicket, balls: 1,
          batsman_id: batsmanId,
          bowler_id:  bowlerId,
        }),
      });

      if (newWkts >= 10) {
        if (innings === 1) {
          setInn1Done(true); setInnings(2);
          setBatsmanId(""); setBowlerId("");
          toast.info(`${match!.team_a_name} ALL OUT! ${match!.team_b_name} innings begins.`);
        } else {
          toast.info(`${match!.team_b_name} ALL OUT! End the match.`);
          setBatsmanId(""); setBowlerId("");
        }
      }
    } catch (e: any) { toast.error(e.message); }
  };

  const finishMatch = async () => {
    try { await api(`/api/matches/${matchId}/complete`, { method: "POST" }); toast.success("Match completed!"); }
    catch (e: any) { toast.error(e.message); }
  };

  const getAnalysis = async () => {
    setAiLoad(true);
    try {
      const r = await api<{ analysis: string }>(`/api/matches/${matchId}/analysis`, { method: "POST" });
      setAnalysis(r.analysis);
    } catch (e: any) { toast.error(e.message); }
    finally { setAiLoad(false); }
  };

  if (!match) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 10, color: "#6b7280" }}>
      <Spinner /> Loading match…
    </div>
  );

  // ── Derived ──────────────────────────────────────────────────────────────
  const overs: BallEvent[][] = [];
  for (let i = 0; i < events.length; i += 6) overs.push(events.slice(i, i + 6));

  const teamAPlayers = players.filter(p => p.team_id === match.team_a_id);
  const teamBPlayers = players.filter(p => p.team_id === match.team_b_id);

  // Current innings batting/bowling
  const battingTeam   = innings === 1 ? "a" : "b";
  const battingName   = innings === 1 ? match.team_a_name : match.team_b_name;
  const bowlingName   = innings === 1 ? match.team_b_name : match.team_a_name;
  const battingList   = innings === 1 ? teamAPlayers : teamBPlayers;
  const bowlingList   = innings === 1 ? teamBPlayers : teamAPlayers;
  const battingWkts   = innings === 1 ? match.team_a_wickets : match.team_b_wickets;
  const isAllOut      = battingWkts >= 10;

  const canScore2     = !!batsmanId && !!bowlerId && !isAllOut;

  const rrA = match.team_a_overs > 0 ? (match.team_a_runs / match.team_a_overs).toFixed(2) : "—";
  const rrB = match.team_b_overs > 0 ? (match.team_b_runs / match.team_b_overs).toFixed(2) : "—";

  const target   = inn1Done ? match.team_a_runs + 1 : null;
  const required = target !== null ? target - match.team_b_runs : null;

  const activePlayers = players.filter(p => p.runs > 0 || p.balls > 0 || p.wickets > 0);

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "scoring",   label: "Live Scoring", icon: Radio },
    { key: "scorecard", label: "Scorecard",    icon: ListOrdered },
    { key: "stats",     label: "Player Stats", icon: BarChart3 },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: "'Barlow',sans-serif" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        select option{background:#0d1520;color:#f0fdf4}
        .run-btn:hover{transform:scale(1.08);background:rgba(16,185,129,0.2)!important;border-color:#10b981!important;color:#10b981!important}
        .w-btn:hover{transform:scale(1.08);background:rgba(239,68,68,0.3)!important}
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Link to="/live" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#6b7280", textDecoration: "none" }}>
          <ArrowLeft size={13} /> All matches
        </Link>
        <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)" }} />
        <StatusBadge status={match.status} />
        <span style={{ fontSize: 13, color: "#6b7280" }}>{match.venue}</span>
        {match.status === "live" && (
          <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", padding: "3px 12px", borderRadius: 20 }}>
            {innings === 1 ? "1st" : "2nd"} Innings
          </span>
        )}
      </div>

      {/* ── Dual scorecards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {([
          { side: "a", name: match.team_a_name, runs: match.team_a_runs, wkts: match.team_a_wickets, ov: match.team_a_overs, rr: rrA, allOut: match.team_a_wickets >= 10 },
          { side: "b", name: match.team_b_name, runs: match.team_b_runs, wkts: match.team_b_wickets, ov: match.team_b_overs, rr: rrB, allOut: match.team_b_wickets >= 10 },
        ] as const).map(t => {
          const isBatting = match.status === "live" && ((innings === 1 && t.side === "a") || (innings === 2 && t.side === "b"));
          return (
            <div key={t.side} style={{ background: "rgba(13,21,32,0.95)", border: `2px solid ${isBatting ? "rgba(16,185,129,0.5)" : t.allOut ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: 16, padding: "20px 24px", position: "relative", overflow: "hidden", transition: "border-color 0.3s", boxShadow: isBatting ? "0 0 24px rgba(16,185,129,0.08)" : "none" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: isBatting ? "linear-gradient(90deg,#10b981,#059669)" : t.allOut ? "linear-gradient(90deg,#ef4444,transparent)" : "linear-gradient(90deg,rgba(255,255,255,0.1),transparent)" }} />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: isBatting ? "#10b981" : "#6b7280" }}>{t.name}</span>
                {isBatting && <span style={{ fontSize: 9, fontWeight: 800, color: "#10b981", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.5px" }}>BATTING</span>}
                {t.allOut && <span style={{ fontSize: 9, fontWeight: 800, color: "#f87171", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", animation: "pulse 2s infinite" }}>ALL OUT</span>}
              </div>

              <div style={{ fontSize: 46, fontWeight: 900, color: t.allOut ? "#fca5a5" : "#f0fdf4", letterSpacing: "-2px", lineHeight: 1, fontFamily: "'Barlow Condensed',sans-serif" }}>
                {t.runs}/{t.wkts}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>{t.ov} ov</span>
                <span style={{ fontSize: 13, color: "#10b981", fontWeight: 700 }}>RR {t.rr}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i < t.wkts ? "#ef4444" : "rgba(255,255,255,0.1)", boxShadow: i < t.wkts ? "0 0 4px #ef4444" : "none", transition: "all 0.3s" }} />
                  ))}
                </div>
              </div>

              {/* Target for team B */}
              {t.side === "b" && target !== null && match.status === "live" && (
                <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: required !== null && required <= 0 ? "#10b981" : "#f59e0b" }}>
                  {required !== null && required <= 0 ? "🏆 Target achieved!" : `Target ${target} · Need ${required} more`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Start button ── */}
      {canScore && match.status === "scheduled" && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button onClick={startMatch} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 40px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#10b981,#059669)", color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 16px rgba(16,185,129,0.35)", fontFamily: "'Barlow',sans-serif" }}>
            <Play size={16} fill="currentColor" /> Start Match
          </button>
        </div>
      )}

      {/* ── Tabs ── */}
      {match.status !== "scheduled" && (
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 22px", fontSize: 13, fontWeight: 700, color: tab === key ? "#10b981" : "#6b7280", background: "transparent", border: "none", borderBottom: `2px solid ${tab === key ? "#10b981" : "transparent"}`, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px", transition: "all 0.2s", fontFamily: "'Barlow',sans-serif", marginBottom: -1 }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          TAB 1 — LIVE SCORING
          ════════════════════════════════════════════════ */}
      {tab === "scoring" && match.status === "live" && canScore && (
        <div style={{ background: "rgba(13,21,32,0.9)", border: `1px solid ${isAllOut ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.2)"}`, borderRadius: 16, padding: 24 }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: isAllOut ? "#f87171" : "#10b981", textTransform: "uppercase", letterSpacing: "1.5px" }}>
                {isAllOut ? `${battingName} ALL OUT` : `${battingName} Batting · ${bowlingName} Bowling`}
              </div>
              {!isAllOut && <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>Select batsman & bowler to unlock scoring</div>}
            </div>
            {innings === 1 && !inn1Done && (
              <button onClick={endInnings1} style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", padding: "5px 14px", borderRadius: 20, cursor: "pointer", fontFamily: "'Barlow',sans-serif" }}>
                End 1st Innings →
              </button>
            )}
          </div>

          {isAllOut ? (
            /* All-out state */
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏏</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#f87171", marginBottom: 6 }}>{battingName} ALL OUT</div>
              <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 20 }}>
                {innings === 1 ? `${match.team_b_name} needs ${match.team_a_runs + 1} to win` : "Both innings complete"}
              </div>
              <button onClick={finishMatch} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 28px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#10b981,#059669)", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow',sans-serif" }}>
                <CheckCircle size={15} /> Declare Result
              </button>
            </div>
          ) : (
            <>
              {/* ── Batsman card (batting team) + Bowler card (bowling team) ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

                {/* BATSMAN — from batting team */}
                <div style={{ background: batsmanId ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${batsmanId ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: 18, transition: "all 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Shield size={14} style={{ color: "#10b981" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.8px" }}>Batsman</div>
                      <div style={{ fontSize: 10, color: "#6b7280" }}>{battingName}</div>
                    </div>
                    {!batsmanId && <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, color: "#f59e0b", background: "rgba(245,158,11,0.12)", padding: "2px 7px", borderRadius: 10, border: "1px solid rgba(245,158,11,0.2)" }}>REQUIRED</span>}
                  </div>
                  <select style={selStyle} value={batsmanId} onChange={e => setBatsmanId(Number(e.target.value) || "")}>
                    <option value="">— Select batsman —</option>
                    {battingList.map(p => {
                      const st = players.find(x => x.id === p.id);
                      return <option key={p.id} value={p.id}>{p.name}{st && st.balls > 0 ? ` (${st.runs} · ${st.balls}b)` : ""}</option>;
                    })}
                  </select>
                  {batsmanId && (() => {
                    const st = players.find(x => x.id === batsmanId);
                    return st ? (
                      <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                        <MiniStat label="Runs" value={st.runs} color="#10b981" />
                        <MiniStat label="Balls" value={st.balls} color="#9ca3af" />
                        <MiniStat label="SR" value={st.balls > 0 ? ((st.runs / st.balls) * 100).toFixed(0) : "—"} color="#a78bfa" />
                      </div>
                    ) : null;
                  })()}
                </div>

                {/* BOWLER — from bowling (opposite) team */}
                <div style={{ background: bowlerId ? "rgba(239,68,68,0.05)" : "rgba(255,255,255,0.03)", border: `1px solid ${bowlerId ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, padding: 18, transition: "all 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Zap size={14} style={{ color: "#f87171" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.8px" }}>Bowler</div>
                      <div style={{ fontSize: 10, color: "#6b7280" }}>{bowlingName}</div>
                    </div>
                    {!bowlerId && <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 800, color: "#f59e0b", background: "rgba(245,158,11,0.12)", padding: "2px 7px", borderRadius: 10, border: "1px solid rgba(245,158,11,0.2)" }}>REQUIRED</span>}
                  </div>
                  <select style={selStyle} value={bowlerId} onChange={e => setBowlerId(Number(e.target.value) || "")}>
                    <option value="">— Select bowler —</option>
                    {bowlingList.map(p => {
                      const st = players.find(x => x.id === p.id);
                      return <option key={p.id} value={p.id}>{p.name}{st && st.wickets > 0 ? ` (${st.wickets}W)` : ""}</option>;
                    })}
                  </select>
                  {bowlerId && (() => {
                    const st = players.find(x => x.id === bowlerId);
                    return st ? (
                      <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                        <MiniStat label="Wkts" value={st.wickets} color="#f87171" />
                        <MiniStat label="Balls" value={st.balls} color="#9ca3af" />
                        <MiniStat label="Runs" value={st.runs} color="#f59e0b" />
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* ── Run buttons — locked until both selected ── */}
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: "18px 20px", border: `1px solid ${canScore2 ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)"}` }}>
                {!canScore2 && (
                  <div style={{ textAlign: "center", fontSize: 12, color: "#f59e0b", fontWeight: 600, marginBottom: 14 }}>
                    ⚠ Select both batsman and bowler above to enable scoring
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", opacity: canScore2 ? 1 : 0.3, pointerEvents: canScore2 ? "auto" : "none", transition: "opacity 0.25s" }}>
                  {[
                    { label: "0", runs: 0, w: false, extra: {} },
                    { label: "1", runs: 1, w: false, extra: {} },
                    { label: "2", runs: 2, w: false, extra: {} },
                    { label: "3", runs: 3, w: false, extra: {} },
                    { label: "4", runs: 4, w: false, extra: { background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.35)", color: "#10b981" } },
                    { label: "6", runs: 6, w: false, extra: { background: "rgba(16,185,129,0.22)", border: "1px solid rgba(16,185,129,0.5)", color: "#10b981", fontSize: 18 } },
                    { label: "W",  runs: 0, w: true,  extra: { background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", fontSize: 18, fontWeight: 900, width: 58 } },
                  ].map(b => (
                    <button key={b.label} className={b.w ? "w-btn" : "run-btn"} onClick={() => addBall(b.runs, b.w)}
                      style={{ width: 52, height: 52, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#e2e8f0", fontSize: 17, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", transition: "transform 0.15s", ...b.extra }}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* End match */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button onClick={finishMatch} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 18px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow',sans-serif" }}>
                  <CheckCircle size={14} /> End Match
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Completed match message on scoring tab */}
      {tab === "scoring" && match.status === "completed" && (
        <MatchResult match={match} />
      )}

      {/* Ball by ball — always shown under scoring tab */}
      {tab === "scoring" && overs.length > 0 && (
        <div style={cardStyle}>
          <SectionTitle>Ball by Ball</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {overs.map((over, i) => {
              const runs = over.reduce((s, e) => s + e.runs, 0);
              const wkts = over.filter(e => e.wicket).length;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 60, flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "'JetBrains Mono',monospace" }}>Over {i + 1}</div>
                    <div style={{ fontSize: 10, color: "#4b5563" }}>{runs}R {wkts > 0 ? `${wkts}W` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 5 }}>
                    {over.map((e, j) => (
                      <span key={j} style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", background: e.wicket ? "rgba(239,68,68,0.2)" : e.runs === 6 ? "rgba(16,185,129,0.25)" : e.runs === 4 ? "rgba(16,185,129,0.14)" : "rgba(255,255,255,0.06)", color: e.wicket ? "#f87171" : e.runs >= 4 ? "#10b981" : "#d1d5db", border: `1px solid ${e.wicket ? "rgba(239,68,68,0.35)" : e.runs >= 4 ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                        {e.wicket ? "W" : e.runs}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Analysis — scoring tab */}
      {tab === "scoring" && (
        <div style={{ background: "rgba(13,21,32,0.9)", border: "1px solid rgba(167,139,250,0.18)", borderRadius: 16, padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: analysis ? 18 : 0 }}>
            <SectionTitle>AI Analysis</SectionTitle>
            <button onClick={getAnalysis} disabled={aiLoading} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 16px", borderRadius: 8, border: "1px solid rgba(167,139,250,0.25)", background: "rgba(167,139,250,0.1)", color: "#a78bfa", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow',sans-serif", opacity: aiLoading ? 0.6 : 1 }}>
              <Sparkles size={13} /> {aiLoading ? "Analyzing…" : "Generate"}
            </button>
          </div>
          {analysis && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {analysis.replace(/\*\*/g,"").replace(/\*/g,"").replace(/#{1,6}\s?/g,"").replace(/`/g,"")
                .split("\n").map(l => l.trim()).filter(l => l.length > 0)
                .map((line, i) => {
                  const sec = /^\d+[\)\.\:]/.test(line);
                  return <p key={i} style={{ margin: 0, fontSize: sec ? 11.5 : 14, fontWeight: sec ? 800 : 400, color: sec ? "#c4b5fd" : "#d1d5db", lineHeight: sec ? 1.4 : 1.75, textTransform: sec ? "uppercase" as const : "none" as const, paddingTop: sec && i > 0 ? 8 : 0 }}>{line}</p>;
                })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          TAB 2 — SCORECARD (cricbuzz style)
          ════════════════════════════════════════════════ */}
      {tab === "scorecard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Team A batting scorecard */}
          <ScorecardTable
            teamName={match.team_a_name}
            innings={1}
            batters={teamAPlayers.filter(p => p.balls > 0)}
            bowlers={teamBPlayers.filter(p => p.balls > 0)}
            totalRuns={match.team_a_runs}
            totalWkts={match.team_a_wickets}
            totalOvers={match.team_a_overs}
          />
          {/* Team B batting scorecard — only if 2nd innings started */}
          {(match.team_b_overs > 0 || inn1Done) && (
            <ScorecardTable
              teamName={match.team_b_name}
              innings={2}
              batters={teamBPlayers.filter(p => p.balls > 0)}
              bowlers={teamAPlayers.filter(p => p.balls > 0)}
              totalRuns={match.team_b_runs}
              totalWkts={match.team_b_wickets}
              totalOvers={match.team_b_overs}
            />
          )}
          {match.team_a_overs === 0 && match.team_b_overs === 0 && (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "#374151", fontSize: 14 }}>No balls bowled yet — scorecard will appear once match starts</div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          TAB 3 — PLAYER STATS WITH CHARTS
          ════════════════════════════════════════════════ */}
      {tab === "stats" && (
        <PlayerStatsTab players={activePlayers} match={match} />
      )}
    </div>
  );
}

// ─── Scorecard Table ─────────────────────────────────────────────────────────
function ScorecardTable({ teamName, innings, batters, bowlers, totalRuns, totalWkts, totalOvers }: {
  teamName: string; innings: number;
  batters: PlayerStat[]; bowlers: PlayerStat[];
  totalRuns: number; totalWkts: number; totalOvers: number;
}) {
  return (
    <div style={{ background: "rgba(13,21,32,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", background: "rgba(16,185,129,0.06)", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#f0fdf4" }}>{teamName}</span>
          <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 8 }}>Innings {innings}</span>
        </div>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 900, color: "#f0fdf4" }}>
          {totalRuns}/{totalWkts}
          <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280", marginLeft: 6 }}>({totalOvers} ov)</span>
        </div>
      </div>

      {/* Batting */}
      {batters.length > 0 && (
        <>
          <div style={{ padding: "8px 20px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "1px" }}>🏏 Batting</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                {["Batter", "R", "B", "SR"].map((h, i) => (
                  <th key={h} style={{ padding: "8px 16px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#4b5563", borderBottom: "1px solid rgba(255,255,255,0.05)", textAlign: i === 0 ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batters.sort((a, b) => b.runs - a.runs).map(p => {
                const sr = p.balls > 0 ? (p.runs / p.balls) * 100 : 0;
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#e2e8f0" }}>{p.name}</div>
                      {p.runs >= 50 && <div style={{ fontSize: 10, color: "#f59e0b" }}>★ {p.runs >= 100 ? "Century" : "Half-century"}</div>}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 900, color: p.runs >= 50 ? "#f59e0b" : "#f0fdf4" }}>{p.runs}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "#9ca3af", fontSize: 13 }}>{p.balls}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: sr >= 150 ? "#10b981" : sr >= 100 ? "#60a5fa" : "#9ca3af" }}>{sr.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {/* Bowling */}
      {bowlers.length > 0 && (
        <>
          <div style={{ padding: "8px 20px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: "1px" }}>🎯 Bowling</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                {["Bowler", "O", "W", "R"].map((h, i) => (
                  <th key={h} style={{ padding: "8px 16px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#4b5563", borderBottom: "1px solid rgba(255,255,255,0.05)", textAlign: i === 0 ? "left" : "right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bowlers.sort((a, b) => b.wickets - a.wickets).map(p => (
                <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#e2e8f0" }}>{p.name}</div>
                    {p.wickets >= 5 && <div style={{ fontSize: 10, color: "#f87171" }}>🔥 5-wicket haul</div>}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "#9ca3af", fontSize: 13 }}>{(p.balls / 6).toFixed(1)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 900, color: p.wickets > 0 ? "#f87171" : "#4b5563" }}>{p.wickets}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "#9ca3af", fontSize: 13 }}>{p.runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {batters.length === 0 && bowlers.length === 0 && (
        <div style={{ padding: "32px 24px", textAlign: "center", color: "#374151", fontSize: 13 }}>No data yet for this innings</div>
      )}
    </div>
  );
}

// ─── Player Stats Tab ─────────────────────────────────────────────────────────
function PlayerStatsTab({ players, match }: { players: PlayerStat[]; match: Match }) {
  const [selected, setSelected] = useState<number | "">("");
  const player = players.find(p => p.id === selected);

  const rrData = [
    { name: match.team_a_name, rr: match.team_a_overs > 0 ? +(match.team_a_runs / match.team_a_overs).toFixed(2) : 0, runs: match.team_a_runs },
    { name: match.team_b_name, rr: match.team_b_overs > 0 ? +(match.team_b_runs / match.team_b_overs).toFixed(2) : 0, runs: match.team_b_runs },
  ];

  const battersSorted = players.filter(p => p.balls > 0).sort((a, b) => b.runs - a.runs).slice(0, 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Team run rate chart */}
      <div style={cardStyle}>
        <SectionTitle>Team Run Rate Comparison</SectionTitle>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={rrData} barCategoryGap="40%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="name" stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 12, fontFamily: "'Barlow',sans-serif" }} />
            <YAxis stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 11 }} label={{ value: "RR", angle: -90, fill: "#6b7280", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "'Barlow',sans-serif" }} labelStyle={{ color: "#e2e8f0", fontWeight: 700 }} itemStyle={{ color: "#10b981" }} />
            <Bar dataKey="rr" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top batters chart */}
      {battersSorted.length > 0 && (
        <div style={cardStyle}>
          <SectionTitle>Top Batters — Runs</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={battersSorted.map(p => ({ name: p.name.split(" ")[0], runs: p.runs, sr: p.balls > 0 ? +((p.runs / p.balls) * 100).toFixed(1) : 0 }))} layout="vertical" barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis dataKey="name" type="category" stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 11, fontFamily: "'Barlow',sans-serif" }} width={70} />
              <Tooltip contentStyle={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} labelStyle={{ color: "#e2e8f0", fontWeight: 700 }} />
              <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 11 }} />
              <Bar dataKey="runs" fill="#10b981" radius={[0, 6, 6, 0]} name="Runs" />
              <Bar dataKey="sr" fill="#a78bfa" radius={[0, 6, 6, 0]} name="Strike Rate" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-player deep dive */}
      <div style={cardStyle}>
        <SectionTitle>Player Deep Dive</SectionTitle>
        <select style={{ ...selStyle, marginBottom: 20 }} value={selected} onChange={e => setSelected(Number(e.target.value) || "")}>
          <option value="">— Choose a player —</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.name} ({p.team_name})</option>)}
        </select>

        {player ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#10b981" }}>{player.name[0]}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#f0fdf4" }}>{player.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{player.team_name}</div>
              </div>
            </div>

            {/* Stat grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
              <BigStat label="Runs" value={player.runs} color="#10b981" />
              <BigStat label="Balls" value={player.balls} color="#9ca3af" />
              <BigStat label="SR" value={player.balls > 0 ? ((player.runs / player.balls) * 100).toFixed(1) : "—"} color="#a78bfa" />
              <BigStat label="Wickets" value={player.wickets} color={player.wickets > 0 ? "#f87171" : "#4b5563"} />
            </div>

            {/* Mini bar chart */}
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={[{ stat: "Runs", value: player.runs }, { stat: "Balls", value: player.balls }, { stat: "S/R", value: player.balls > 0 ? +((player.runs / player.balls) * 100).toFixed(1) : 0 }, { stat: "Wkts×10", value: player.wickets * 10 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="stat" stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis stroke="#4b5563" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} labelStyle={{ color: "#e2e8f0" }} itemStyle={{ color: "#10b981" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}
                  fill="url(#grad)"
                />
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#374151", fontSize: 13 }}>
            Select a player above to view their detailed statistics and charts
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function MatchResult({ match }: { match: Match }) {
  const winnerName = match.winner_id === match.team_a_id ? match.team_a_name : match.winner_id === match.team_b_id ? match.team_b_name : null;
  const margin = Math.abs(match.team_a_runs - match.team_b_runs);
  return (
    <div style={{ textAlign: "center", padding: "40px 24px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 16 }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>🏆</div>
      {winnerName ? (
        <>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#10b981", fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase" }}>{winnerName} Won!</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 6 }}>by {margin} runs</div>
        </>
      ) : (
        <div style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b" }}>Match Tied!</div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: "'Barlow Condensed',sans-serif" }}>{value}</div>
    </div>
  );
}

function BigStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 10px", textAlign: "center", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color, fontFamily: "'Barlow Condensed',sans-serif" }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; border: string }> = {
    live:      { bg: "rgba(239,68,68,0.12)",   color: "#f87171", border: "rgba(239,68,68,0.25)" },
    scheduled: { bg: "rgba(96,165,250,0.1)",   color: "#93c5fd", border: "rgba(96,165,250,0.2)" },
    completed: { bg: "rgba(107,114,128,0.12)", color: "#9ca3af", border: "rgba(107,114,128,0.2)" },
  };
  const c = cfg[status] ?? cfg.scheduled;
  return <span style={{ padding: "3px 10px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.5px", background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{status}</span>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 14 }}>{children}</div>;
}

function Spinner() {
  return <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #10b981", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />;
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = { background: "rgba(13,21,32,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 22 };
const selStyle: React.CSSProperties  = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f0fdf4", fontSize: 13, outline: "none", fontFamily: "'Barlow',sans-serif", cursor: "pointer", boxSizing: "border-box" as const };