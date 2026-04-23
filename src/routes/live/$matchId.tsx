import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import {
  api, WS_URL,
  dismissalText, runRate, requiredRunRate, oversToBalls,
  type Match, type BallEvent, type BattingRow, type BowlingRow, type Player,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  ArrowLeft, Play, Sparkles, BarChart3,
  ListOrdered, Radio, ChevronRight, AlertTriangle, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/live/$matchId")({
  component: () => <AppShell><LiveMatch /></AppShell>,
});

type Tab = "scoring" | "scorecard" | "stats" | "fowl";

const EXTRA_TYPES = ["wide", "noball", "bye", "legbye"] as const;
type ExtraType = typeof EXTRA_TYPES[number];
const DISMISSAL_TYPES = ["bowled","caught","lbw","run_out","stumped","hit_wicket","retired_hurt"] as const;

// ─────────────────────────────────────────────────────────────────────────────
function LiveMatch() {
  const { matchId } = Route.useParams();
  const { canScore } = useAuth();

  const [match,    setMatch]    = useState<Match | null>(null);
  const [players,  setPlayers]  = useState<Player[]>([]);
  const [tab,      setTab]      = useState<Tab>("scoring");
  const [analysis, setAnalysis] = useState("");
  const [aiLoad,   setAiLoad]   = useState(false);

  const [inn1Bat,  setInn1Bat]  = useState<BattingRow[]>([]);
  const [inn1Bowl, setInn1Bowl] = useState<BowlingRow[]>([]);
  const [inn2Bat,  setInn2Bat]  = useState<BattingRow[]>([]);
  const [inn2Bowl, setInn2Bowl] = useState<BowlingRow[]>([]);
  const [inn1Ev,   setInn1Ev]   = useState<BallEvent[]>([]);
  const [inn2Ev,   setInn2Ev]   = useState<BallEvent[]>([]);

  // TWO batsmen at the crease
  const [strikerId,    setStrikerId]    = useState<number | "">("");
  const [nonStrikerId, setNonStrikerId] = useState<number | "">("");
  const [bowlerId,     setBowlerId]     = useState<number | "">("");

  const [runsBat,      setRunsBat]      = useState(0);
  const [extraType,    setExtraType]    = useState<ExtraType | "">("");
  const [extraRuns,    setExtraRuns]    = useState(0);
  const [isWicket,     setIsWicket]     = useState(false);
  const [dismissal,    setDismissal]    = useState<string>("");
  const [fielderId,    setFielderId]    = useState<number | "">("");
  const [outBatsmanId, setOutBatsmanId] = useState<number | "">("");
  const [delivering,   setDelivering]   = useState(false);

  const [showToss,     setShowToss]     = useState(false);
  const [tossWinner,   setTossWinner]   = useState<number | "">("");
  const [tossDecision, setTossDecision] = useState<"bat"|"bowl">("bat");

  // Dismissed players per innings (to exclude from selects)
  const [dismissedInn1, setDismissedInn1] = useState<Set<number>>(new Set());
  const [dismissedInn2, setDismissedInn2] = useState<Set<number>>(new Set());

  // Partnership tracking
  const [partnershipRuns, setPartnershipRuns] = useState(0);
  const [partnershipBalls, setPartnershipBalls] = useState(0);

  // Last over summary
  const [lastOverRuns, setLastOverRuns] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const buildDismissedSets = useCallback((bat1: BattingRow[], bat2: BattingRow[]) => {
    const d1 = new Set<number>(bat1.filter(r => r.is_out).map(r => r.player_id));
    const d2 = new Set<number>(bat2.filter(r => r.is_out).map(r => r.player_id));
    setDismissedInn1(d1);
    setDismissedInn2(d2);
  }, []);

  const computePartnership = useCallback((events: BallEvent[], striker: number | "", nonStriker: number | "") => {
    if (!striker || !nonStriker) return;
    // Find last wicket event index
    let lastWicketIdx = -1;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].is_wicket) { lastWicketIdx = i; break; }
    }
    const partnerEvents = events.slice(lastWicketIdx + 1);
    const runs = partnerEvents.reduce((s, e) => s + e.runs_bat + e.runs_extra, 0);
    const balls = partnerEvents.filter(e => !e.extra_type || e.extra_type === "bye" || e.extra_type === "legbye").length;
    setPartnershipRuns(runs);
    setPartnershipBalls(balls);
  }, []);

  const loadInningsData = useCallback(async (m: Match) => {
    const inn1 = m.current_innings >= 1;
    const inn2 = m.current_innings === 2 || (m.inn2_balls > 0);
    const [b1, w1, e1] = inn1 ? await Promise.all([
      api<BattingRow[]>(`/api/matches/${matchId}/innings/1/batting`),
      api<BowlingRow[]>(`/api/matches/${matchId}/innings/1/bowling`),
      api<BallEvent[]>(`/api/matches/${matchId}/innings/1/events`),
    ]) : [[], [], []];
    setInn1Bat(b1); setInn1Bowl(w1); setInn1Ev(e1);

    let b2: BattingRow[] = [], w2: BowlingRow[] = [], e2: BallEvent[] = [];
    if (inn2) {
      [b2, w2, e2] = await Promise.all([
        api<BattingRow[]>(`/api/matches/${matchId}/innings/2/batting`),
        api<BowlingRow[]>(`/api/matches/${matchId}/innings/2/bowling`),
        api<BallEvent[]>(`/api/matches/${matchId}/innings/2/events`),
      ]);
      setInn2Bat(b2); setInn2Bowl(w2); setInn2Ev(e2);
    }

    buildDismissedSets(b1, b2);

    // Compute last over runs
    const curEvents = m.current_innings === 1 ? e1 : e2;
    const curBalls = m.current_innings === 1 ? m.inn1_balls : m.inn2_balls;
    const completedOvers = Math.floor(curBalls / 6);
    if (completedOvers > 0) {
      const lastOverEvs = curEvents.filter(e => e.over_num === completedOvers - 1);
      setLastOverRuns(lastOverEvs.reduce((s, e) => s + e.runs_bat + e.runs_extra, 0));
    }

    // Compute partnership
    if (m.status === "live") {
      const activeEvents = m.current_innings === 1 ? e1 : e2;
      computePartnership(activeEvents, strikerId, nonStrikerId);
    }
  }, [matchId, buildDismissedSets, computePartnership, strikerId, nonStrikerId]);

  useEffect(() => {
    Promise.all([
      api<Match>(`/api/matches/${matchId}`),
    ]).then(async ([m]) => {
      setMatch(m);
      const tId = m.tournament_id;
      const p = await api<Player[]>(`/api/tournaments/${tId}/players`);
      setPlayers(p.filter(pl => pl.team_id === m.team_a_id || pl.team_id === m.team_b_id));
      await loadInningsData(m);
    });
  }, [matchId, loadInningsData]);

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/ws?matchId=${matchId}`);
    ws.onmessage = async ev => {
      try {
        const d = JSON.parse(ev.data);
        if (d.type === "score") {
          setMatch(d.match);
          await loadInningsData(d.match);
        }
      } catch {}
    };
    wsRef.current = ws;
    return () => ws.close();
  }, [matchId, loadInningsData]);

  // Auto-rotate strike on odd runs
  const rotateStrike = useCallback((runs: number, isWide: boolean, isRunOut: boolean) => {
    if (isWide) return;
    if (runs % 2 === 1) {
      // Swap striker and non-striker
      setStrikerId(prev => {
        setNonStrikerId(prev);
        return nonStrikerId;
      });
    }
    // End of over: rotate
  }, [nonStrikerId]);

  const startMatch = async () => {
    try {
      const m = await api<Match>(`/api/matches/${matchId}/start`, { method: "POST" });
      setMatch(m); await loadInningsData(m);
      toast.success("Match started!");
    } catch (e: any) { toast.error(e.message); }
  };

  const saveToss = async () => {
    if (!tossWinner) { toast.error("Select toss winner"); return; }
    try {
      await api(`/api/matches/${matchId}/toss`, {
        method: "POST",
        body: JSON.stringify({ toss_winner_id: tossWinner, toss_decision: tossDecision }),
      });
      setShowToss(false);
      toast.success("Toss recorded");
      const m = await api<Match>(`/api/matches/${matchId}`);
      setMatch(m);
    } catch (e: any) { toast.error(e.message); }
  };

  const endInnings = async () => {
    try {
      const m = await api<Match>(`/api/matches/${matchId}/end-innings`, { method: "POST" });
      setMatch(m);
      setStrikerId(""); setNonStrikerId(""); setBowlerId("");
      setPartnershipRuns(0); setPartnershipBalls(0);
      toast.success("Innings ended! Team 2 bats now.");
    } catch (e: any) { toast.error(e.message); }
  };

  const completeMatch = async () => {
    try {
      const m = await api<Match>(`/api/matches/${matchId}/complete`, { method: "POST" });
      setMatch(m); await loadInningsData(m);
      toast.success("Match completed!");
    } catch (e: any) { toast.error(e.message); }
  };

  const submitDelivery = async () => {
    if (!strikerId) { toast.error("Select striker"); return; }
    if (!nonStrikerId) { toast.error("Select non-striker"); return; }
    if (strikerId === nonStrikerId) { toast.error("Striker and non-striker must be different"); return; }
    if (!bowlerId)  { toast.error("Select bowler");  return; }
    if (isWicket && !dismissal) { toast.error("Select dismissal type"); return; }
    if (["caught","stumped","run_out"].includes(dismissal) && !fielderId) {
      toast.error("Select fielder for this dismissal"); return;
    }
    if (isWicket && dismissal === "run_out" && !outBatsmanId) {
      toast.error("Select which batsman is run out"); return;
    }
    setDelivering(true);
    try {
      const actualOut = isWicket && dismissal === "run_out" ? outBatsmanId : strikerId;
      const m = await api<Match>(`/api/matches/${matchId}/delivery`, {
        method: "POST",
        body: JSON.stringify({
          batsman_id: strikerId,
          bowler_id:  bowlerId,
          runs_bat:   runsBat,
          extra_type: extraType || undefined,
          extra_runs: extraRuns,
          is_wicket:  isWicket,
          dismissal_type: isWicket ? dismissal : undefined,
          fielder_id: fielderId || undefined,
          out_batsman_id: actualOut || undefined,
        }),
      });
      setMatch(m); await loadInningsData(m);

      const isWide = extraType === "wide";
      const isNoball = extraType === "noball";
      const isLegal = !extraType || extraType === "bye" || extraType === "legbye";

      // Handle dismissal
      if (isWicket) {
        const outId = dismissal === "run_out" ? (outBatsmanId || strikerId) : strikerId;
        // Remove from crease
        if (outId === strikerId) setStrikerId("");
        else if (outId === nonStrikerId) setNonStrikerId("");
        // Reset
        setDismissal(""); setFielderId(""); setOutBatsmanId("");
        setIsWicket(false);
        setPartnershipRuns(0); setPartnershipBalls(0);
      } else {
        // Rotate strike on odd runs (end of over handles too)
        const newBalls = (m.current_innings === 1 ? m.inn1_balls : m.inn2_balls);
        const justCompletedOver = isLegal && newBalls % 6 === 0 && newBalls > 0;
        const oddRuns = runsBat % 2 === 1 && !isWide;

        if (justCompletedOver) {
          // Always rotate at end of over
          const tmp = strikerId;
          setStrikerId(nonStrikerId);
          setNonStrikerId(tmp);
        } else if (oddRuns) {
          const tmp = strikerId;
          setStrikerId(nonStrikerId);
          setNonStrikerId(tmp);
        }
      }

      // Reset delivery form
      setRunsBat(0); setExtraType(""); setExtraRuns(0);
      setIsWicket(false); setDismissal(""); setFielderId(""); setOutBatsmanId("");

      const wkts = m.current_innings === 1 ? m.inn1_wickets : m.inn2_wickets;
      if (wkts >= 10) toast.info("All out! End the innings.");
    } catch (e: any) { toast.error(e.message); }
    finally { setDelivering(false); }
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
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200, gap:10, color:"#6b7280" }}>
      <Spinner /> Loading…
    </div>
  );

  const inn = match.current_innings;
  const inn1BatId = match.inn1_batting_team_id;
  const inn2BatId = match.inn2_batting_team_id;
  const inn1BowlId = inn1BatId === match.team_a_id ? match.team_b_id : match.team_a_id;

  const battingTeamId  = inn === 1 ? inn1BatId : inn2BatId;
  const bowlingTeamId  = inn === 1 ? inn1BowlId : (inn2BatId === match.team_a_id ? match.team_b_id : match.team_a_id);
  const battingName    = battingTeamId === match.team_a_id ? match.team_a_name : match.team_b_name;
  const bowlingName    = bowlingTeamId === match.team_a_id ? match.team_a_name : match.team_b_name;
  const battingPlayers = players.filter(p => p.team_id === battingTeamId);
  const bowlingPlayers = players.filter(p => p.team_id === bowlingTeamId);

  const dismissedThisInn = inn === 1 ? dismissedInn1 : dismissedInn2;
  const availableBatsmen = battingPlayers.filter(p =>
    !dismissedThisInn.has(p.id) && p.id !== strikerId && p.id !== nonStrikerId
  );
  const strikerAvail    = battingPlayers.filter(p => !dismissedThisInn.has(p.id) && p.id !== nonStrikerId);
  const nonStrikerAvail = battingPlayers.filter(p => !dismissedThisInn.has(p.id) && p.id !== strikerId);

  const curRuns    = inn === 1 ? match.inn1_runs    : match.inn2_runs;
  const curWkts    = inn === 1 ? match.inn1_wickets : match.inn2_wickets;
  const curBalls   = inn === 1 ? match.inn1_balls   : match.inn2_balls;
  const curOvers   = inn === 1 ? match.inn1_overs   : match.inn2_overs;
  const isAllOut   = curWkts >= 10;

  const curEvents  = inn === 1 ? inn1Ev : inn2Ev;
  const legalBalls = curEvents.filter(e => !e.extra_type || e.extra_type === "bye" || e.extra_type === "legbye");
  const currentOverNum = Math.floor(curBalls / 6);
  const currentOverAll = curEvents.filter(e => e.over_num === currentOverNum);

  const curRR = runRate(curRuns, curBalls);

  const target    = inn === 2 ? match.inn1_runs + 1 : null;
  const needed    = target !== null ? target - match.inn2_runs : null;
  const maxBalls  = 120;
  const ballsRemaining = target !== null ? maxBalls - match.inn2_balls : null;
  const rrr = (needed !== null && ballsRemaining !== null) ? requiredRunRate(needed, ballsRemaining) : null;

  // Current batsmen stats from batting rows
  const curBatRows = inn === 1 ? inn1Bat : inn2Bat;
  const strikerRow    = curBatRows.find(r => r.player_id === strikerId);
  const nonStrikerRow = curBatRows.find(r => r.player_id === nonStrikerId);
  const bowlerRow     = (inn === 1 ? inn1Bowl : inn2Bowl).find(r => r.player_id === bowlerId);

  const tabs: { key: Tab; icon: any; label: string }[] = [
    { key: "scoring",   icon: Radio,       label: "Scoring" },
    { key: "scorecard", icon: ListOrdered, label: "Scorecard" },
    { key: "stats",     icon: BarChart3,   label: "Stats" },
    { key: "fowl",      icon: AlertTriangle, label: "Fall of Wickets" },
  ];

  const resultText = match.win_type === "wickets"
    ? `${(match.winner_id === match.team_a_id ? match.team_a_name : match.team_b_name)} won by ${match.win_margin} wickets`
    : match.win_type === "runs"
    ? `${(match.winner_id === match.team_a_id ? match.team_a_name : match.team_b_name)} won by ${match.win_margin} runs`
    : match.win_type === "tie" ? "Match Tied" : "";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20, fontFamily:"'Barlow',sans-serif" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes slideIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        select option{background:#0d1520;color:#f0fdf4}
        input[type=number]{-moz-appearance:textfield}
        input[type=number]::-webkit-inner-spin-button{display:none}
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <Link to="/live" style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12.5, color:"#6b7280", textDecoration:"none" }}>
          <ArrowLeft size={13}/> All matches
        </Link>
        <span style={{ color:"rgba(255,255,255,0.1)" }}>|</span>
        <StatusBadge status={match.status}/>
        <span style={{ fontSize:13, color:"#6b7280" }}>{match.venue}</span>
        {match.status === "live" && (
          <span style={{ marginLeft:"auto", fontSize:11, fontWeight:700, color:"#10b981", background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.2)", padding:"3px 12px", borderRadius:20 }}>
            {inn === 1 ? "1st" : "2nd"} Innings · {battingName} batting
          </span>
        )}
        {match.status === "completed" && resultText && (
          <span style={{ marginLeft:"auto", fontSize:12, fontWeight:700, color:"#f59e0b" }}>🏆 {resultText}</span>
        )}
      </div>

      {/* ── Toss info ── */}
      {match.toss_winner_id && (
        <div style={{ fontSize:12, color:"#6b7280", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:8, padding:"8px 14px" }}>
          🪙 Toss: <strong style={{ color:"#e2e8f0" }}>
            {match.toss_winner_id === match.team_a_id ? match.team_a_name : match.team_b_name}
          </strong> won and chose to <strong style={{ color:"#10b981" }}>{match.toss_decision}</strong>
        </div>
      )}

      {/* ── Dual scorecards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {([
          { side:"inn1", name: inn1BatId === match.team_a_id ? match.team_a_name : match.team_b_name,
            runs: match.inn1_runs, wkts: match.inn1_wickets, overs: match.inn1_overs,
            extras: match.inn1_extras, wides: match.inn1_wides, nb: match.inn1_noballs,
            byes: match.inn1_byes, lb: match.inn1_legbyes, isBatting: match.status==="live" && inn===1 },
          { side:"inn2", name: inn2BatId === match.team_a_id ? match.team_a_name : match.team_b_name,
            runs: match.inn2_runs, wkts: match.inn2_wickets, overs: match.inn2_overs,
            extras: match.inn2_extras, wides: match.inn2_wides, nb: match.inn2_noballs,
            byes: match.inn2_byes, lb: match.inn2_legbyes, isBatting: match.status==="live" && inn===2 },
        ] as any[]).map(t => {
          const allOut = t.wkts >= 10;
          const rr = runRate(t.runs, oversToBalls(t.overs) ? oversToBalls(t.overs) : 0);
          return (
            <div key={t.side} style={{ background:"rgba(13,21,32,0.95)", border:`2px solid ${t.isBatting ? "rgba(16,185,129,0.5)" : allOut ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)"}`, borderRadius:16, padding:"18px 22px", position:"relative", overflow:"hidden", transition:"border-color 0.3s" }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background: t.isBatting ? "linear-gradient(90deg,#10b981,#059669)" : allOut ? "linear-gradient(90deg,#ef4444,transparent)" : "linear-gradient(90deg,rgba(255,255,255,0.08),transparent)" }}/>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"1px", color: t.isBatting?"#10b981":"#6b7280" }}>{t.name}</span>
                <div style={{ display:"flex", gap:6 }}>
                  {t.isBatting && <Chip c="#10b981">BATTING</Chip>}
                  {allOut && <Chip c="#f87171" pulse>ALL OUT</Chip>}
                </div>
              </div>
              <div style={{ fontSize:48, fontWeight:900, color: allOut?"#fca5a5":"#f0fdf4", letterSpacing:"-2px", lineHeight:1, fontFamily:"'Barlow Condensed',sans-serif" }}>
                {t.runs}/{t.wkts}
              </div>
              <div style={{ display:"flex", gap:16, marginTop:8, alignItems:"center", flexWrap:"wrap" }}>
                <span style={{ fontSize:13, color:"#6b7280" }}>{t.overs} ov</span>
                {t.runs > 0 && <span style={{ fontSize:13, color:"#10b981", fontWeight:700 }}>RR {rr}</span>}
                {t.extras > 0 && <span style={{ fontSize:12, color:"#6b7280" }}>Extras {t.extras} (W:{t.wides} NB:{t.nb} B:{t.byes} LB:{t.lb})</span>}
              </div>
              <div style={{ display:"flex", gap:3, marginTop:10 }}>
                {Array.from({length:10}).map((_,i) => (
                  <div key={i} style={{ width:8, height:8, borderRadius:"50%", background: i<t.wkts?"#ef4444":"rgba(255,255,255,0.1)", boxShadow: i<t.wkts?"0 0 4px #ef4444":"none", transition:"all 0.3s" }}/>
                ))}
              </div>
              {t.side==="inn2" && target !== null && match.status==="live" && (
                <div style={{ marginTop:10, fontSize:12, fontWeight:700, color: needed!<=0?"#10b981":"#f59e0b" }}>
                  {needed!<=0 ? "🏆 Target achieved!" : `Target ${target} · Need ${needed} off ${ballsRemaining} balls · RRR ${rrr}`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Live crease panel ── */}
      {match.status === "live" && (strikerId || nonStrikerId) && (
        <div style={{ background:"rgba(13,21,32,0.95)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:14, padding:"14px 18px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#10b981", textTransform:"uppercase", letterSpacing:"1.5px", marginBottom:12 }}>At the Crease</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            {/* Striker */}
            <div style={{ background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.3)", borderRadius:10, padding:"10px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                <span style={{ fontSize:18 }}>🏏</span>
                <div>
                  <div style={{ fontSize:9, fontWeight:700, color:"#10b981", textTransform:"uppercase", letterSpacing:"1px" }}>Striker *</div>
                  <div style={{ fontSize:13, fontWeight:800, color:"#f0fdf4" }}>{players.find(p=>p.id===strikerId)?.name || "—"}</div>
                </div>
              </div>
              {strikerRow && (
                <div style={{ display:"flex", gap:12, fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>
                  <span style={{ fontWeight:900, color:"#f0fdf4", fontSize:20 }}>{strikerRow.runs}</span>
                  <span style={{ color:"#6b7280" }}>({strikerRow.balls_faced})</span>
                  <span style={{ color:strikerRow.balls_faced>0&&(strikerRow.runs/strikerRow.balls_faced*100)>=150?"#10b981":"#9ca3af", fontSize:11 }}>
                    SR: {strikerRow.balls_faced > 0 ? (strikerRow.runs/strikerRow.balls_faced*100).toFixed(0) : "0"}
                  </span>
                </div>
              )}
              {strikerRow && (
                <div style={{ fontSize:11, color:"#6b7280", marginTop:4 }}>
                  {strikerRow.fours}×4 · {strikerRow.sixes}×6
                </div>
              )}
            </div>

            {/* Non-striker */}
            <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"10px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                <span style={{ fontSize:18 }}>🏏</span>
                <div>
                  <div style={{ fontSize:9, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"1px" }}>Non-Striker</div>
                  <div style={{ fontSize:13, fontWeight:800, color:"#e2e8f0" }}>{players.find(p=>p.id===nonStrikerId)?.name || "—"}</div>
                </div>
              </div>
              {nonStrikerRow && (
                <div style={{ display:"flex", gap:12, fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>
                  <span style={{ fontWeight:900, color:"#e2e8f0", fontSize:20 }}>{nonStrikerRow.runs}</span>
                  <span style={{ color:"#6b7280" }}>({nonStrikerRow.balls_faced})</span>
                  <span style={{ fontSize:11, color:"#9ca3af" }}>
                    SR: {nonStrikerRow.balls_faced > 0 ? (nonStrikerRow.runs/nonStrikerRow.balls_faced*100).toFixed(0) : "0"}
                  </span>
                </div>
              )}
              {nonStrikerRow && (
                <div style={{ fontSize:11, color:"#6b7280", marginTop:4 }}>
                  {nonStrikerRow.fours}×4 · {nonStrikerRow.sixes}×6
                </div>
              )}
            </div>

            {/* Bowler + Partnership */}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.2)", borderRadius:10, padding:"10px 14px" }}>
                <div style={{ fontSize:9, fontWeight:700, color:"#f87171", textTransform:"uppercase", letterSpacing:"1px", marginBottom:4 }}>Bowler</div>
                <div style={{ fontSize:13, fontWeight:800, color:"#f0fdf4" }}>{players.find(p=>p.id===bowlerId)?.name || "—"}</div>
                {bowlerRow && (
                  <div style={{ fontSize:11, color:"#6b7280", marginTop:4, fontFamily:"'JetBrains Mono',monospace" }}>
                    {bowlerRow.wickets}W · {Math.floor(bowlerRow.balls_bowled/6)}.{bowlerRow.balls_bowled%6}ov · Econ {bowlerRow.balls_bowled>0?((bowlerRow.runs_conceded/bowlerRow.balls_bowled)*6).toFixed(1):"—"}
                  </div>
                )}
              </div>
              <div style={{ background:"rgba(167,139,250,0.08)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:10, padding:"10px 14px" }}>
                <div style={{ fontSize:9, fontWeight:700, color:"#a78bfa", textTransform:"uppercase", letterSpacing:"1px", marginBottom:4 }}>Partnership</div>
                <div style={{ fontSize:16, fontWeight:900, color:"#f0fdf4", fontFamily:"'JetBrains Mono',monospace" }}>
                  {partnershipRuns} <span style={{ fontSize:11, color:"#6b7280", fontWeight:400 }}>({partnershipBalls}b)</span>
                </div>
                {lastOverRuns !== null && (
                  <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>Last ov: {lastOverRuns}</div>
                )}
              </div>
            </div>
          </div>

          {/* Swap strike button */}
          <button
            onClick={() => { const tmp = strikerId; setStrikerId(nonStrikerId); setNonStrikerId(tmp as any); }}
            style={{ marginTop:10, display:"inline-flex", alignItems:"center", gap:6, fontSize:11, fontWeight:700, color:"#10b981", background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.2)", padding:"4px 12px", borderRadius:20, cursor:"pointer" }}
          >
            <RefreshCw size={11}/> Swap Strike
          </button>
        </div>
      )}

      {/* ── Start / toss buttons ── */}
      {match.status === "scheduled" && canScore && (
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          {!match.toss_winner_id && (
            <button onClick={()=>setShowToss(true)} style={ghostBtn}>🪙 Record Toss</button>
          )}
          <button onClick={startMatch} style={primaryBtn}>
            <Play size={15} fill="currentColor"/> Start Match
          </button>
        </div>
      )}

      {/* ── Toss modal ── */}
      {showToss && (
        <Modal title="Record Toss" onClose={()=>setShowToss(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <Label>Toss Won By</Label>
              <select style={selStyle} value={tossWinner} onChange={e=>setTossWinner(Number(e.target.value)||"")}>
                <option value="">— Select team —</option>
                <option value={match.team_a_id}>{match.team_a_name}</option>
                <option value={match.team_b_id}>{match.team_b_name}</option>
              </select>
            </div>
            <div>
              <Label>Decision</Label>
              <div style={{ display:"flex", gap:10 }}>
                {(["bat","bowl"] as const).map(d=>(
                  <button key={d} onClick={()=>setTossDecision(d)} style={{ flex:1, padding:"9px", borderRadius:9, border:`1px solid ${tossDecision===d?"#10b981":"rgba(255,255,255,0.1)"}`, background:tossDecision===d?"rgba(16,185,129,0.15)":"rgba(255,255,255,0.04)", color:tossDecision===d?"#10b981":"#9ca3af", fontWeight:700, cursor:"pointer", textTransform:"uppercase", fontSize:13 }}>
                    {d === "bat" ? "🏏 Bat First" : "🎯 Bowl First"}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={saveToss} style={primaryBtn}>Save Toss</button>
          </div>
        </Modal>
      )}

      {/* ── Tabs ── */}
      {match.status !== "scheduled" && (
        <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.07)", flexWrap:"wrap" }}>
          {tabs.map(({key,icon:Icon,label})=>(
            <button key={key} onClick={()=>setTab(key)} style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 16px", fontSize:13, fontWeight:700, color:tab===key?"#10b981":"#6b7280", background:"transparent", border:"none", borderBottom:`2px solid ${tab===key?"#10b981":"transparent"}`, cursor:"pointer", transition:"all 0.2s", fontFamily:"'Barlow',sans-serif", marginBottom:-1, letterSpacing:"0.3px" }}>
              <Icon size={13}/> {label}
            </button>
          ))}
        </div>
      )}

      {/* ══ SCORING TAB ══ */}
      {tab === "scoring" && match.status === "live" && canScore && (
        <ScoringPanel
          match={match} inn={inn} battingName={battingName} bowlingName={bowlingName}
          battingPlayers={battingPlayers} bowlingPlayers={bowlingPlayers}
          allPlayers={players} curRuns={curRuns} curWkts={curWkts} curBalls={curBalls}
          curOvers={curOvers} isAllOut={isAllOut}
          strikerId={strikerId} setStrikerId={setStrikerId}
          nonStrikerId={nonStrikerId} setNonStrikerId={setNonStrikerId}
          strikerAvail={strikerAvail} nonStrikerAvail={nonStrikerAvail}
          bowlerId={bowlerId} setBowlerId={setBowlerId}
          runsBat={runsBat} setRunsBat={setRunsBat}
          extraType={extraType} setExtraType={setExtraType}
          extraRuns={extraRuns} setExtraRuns={setExtraRuns}
          isWicket={isWicket} setIsWicket={setIsWicket}
          dismissal={dismissal} setDismissal={setDismissal}
          fielderId={fielderId} setFielderId={setFielderId}
          outBatsmanId={outBatsmanId} setOutBatsmanId={setOutBatsmanId}
          delivering={delivering}
          onSubmit={submitDelivery}
          onEndInnings={endInnings}
          onComplete={completeMatch}
          inn1Done={match.current_innings === 2}
          target={target} needed={needed} ballsRemaining={ballsRemaining} rrr={rrr}
          inn1Events={inn1Ev} inn2Events={inn2Ev}
          curBatRows={curBatRows}
        />
      )}

      {tab === "scoring" && match.status === "completed" && (
        <div style={{ textAlign:"center", padding:"40px 24px", background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:16 }}>
          <div style={{ fontSize:48, marginBottom:10 }}>🏆</div>
          <div style={{ fontSize:26, fontWeight:900, color:"#10b981", fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase" }}>
            {resultText || "Match Complete"}
          </div>
        </div>
      )}

      {tab === "scoring" && (
        <>
          <CurrentOverDisplay events={currentOverAll} curOvers={curOvers} overNum={currentOverNum}/>
          <OverSummaryBar events={inn === 1 ? inn1Ev : inn2Ev} totalBalls={curBalls}/>
          <BallByBallDisplay inn1Events={inn1Ev} inn2Events={inn2Ev} match={match}/>
          <AnalysisPanel analysis={analysis} aiLoad={aiLoad} onGenerate={getAnalysis}/>
        </>
      )}

      {/* ══ SCORECARD TAB ══ */}
      {tab === "scorecard" && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          <ScorecardInnings
            title={`${inn1BatId === match.team_a_id ? match.team_a_name : match.team_b_name} Innings`}
            batting={inn1Bat} bowling={inn1Bowl}
            runs={match.inn1_runs} wkts={match.inn1_wickets} overs={match.inn1_overs}
            wides={match.inn1_wides} noballs={match.inn1_noballs}
            byes={match.inn1_byes} legbyes={match.inn1_legbyes} extras={match.inn1_extras}
          />
          {match.inn2_balls > 0 && (
            <ScorecardInnings
              title={`${inn2BatId === match.team_a_id ? match.team_a_name : match.team_b_name} Innings`}
              batting={inn2Bat} bowling={inn2Bowl}
              runs={match.inn2_runs} wkts={match.inn2_wickets} overs={match.inn2_overs}
              wides={match.inn2_wides} noballs={match.inn2_noballs}
              byes={match.inn2_byes} legbyes={match.inn2_legbyes} extras={match.inn2_extras}
            />
          )}
        </div>
      )}

      {/* ══ STATS TAB ══ */}
      {tab === "stats" && (
        <StatsTab inn1Bat={inn1Bat} inn2Bat={inn2Bat} inn1Bowl={inn1Bowl} inn2Bowl={inn2Bowl}
          match={match} inn1Events={inn1Ev} inn2Events={inn2Ev}/>
      )}

      {/* ══ FALL OF WICKETS TAB ══ */}
      {tab === "fowl" && (
        <FallOfWicketsTab inn1Events={inn1Ev} inn2Events={inn2Ev} match={match}
          inn1BatName={inn1BatId === match.team_a_id ? match.team_a_name : match.team_b_name}
          inn2BatName={inn2BatId === match.team_a_id ? match.team_a_name : match.team_b_name}
        />
      )}
    </div>
  );
}

// ─── Scoring Panel ────────────────────────────────────────────────────────────
function ScoringPanel(props: any) {
  const {
    match, inn, battingName, bowlingName,
    battingPlayers, bowlingPlayers, allPlayers,
    curRuns, curWkts, curBalls, curOvers, isAllOut,
    strikerId, setStrikerId, nonStrikerId, setNonStrikerId,
    strikerAvail, nonStrikerAvail,
    bowlerId, setBowlerId,
    runsBat, setRunsBat, extraType, setExtraType,
    extraRuns, setExtraRuns, isWicket, setIsWicket,
    dismissal, setDismissal, fielderId, setFielderId,
    outBatsmanId, setOutBatsmanId,
    delivering, onSubmit, onEndInnings, onComplete,
    inn1Done, target, needed, ballsRemaining, rrr,
    curBatRows,
  } = props;

  const needsFielder = ["caught","stumped","run_out"].includes(dismissal);
  const isWide = extraType === "wide";
  const isNoball = extraType === "noball";
  const hasExtra = !!extraType;
  const isRunOut = dismissal === "run_out";

  if (isAllOut) return (
    <div style={{ background:"rgba(13,21,32,0.9)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:16, padding:28, textAlign:"center" }}>
      <div style={{ fontSize:36, marginBottom:8 }}>🏏</div>
      <div style={{ fontSize:20, fontWeight:900, color:"#f87171" }}>{battingName} ALL OUT — {curRuns}</div>
      {inn === 1 && <div style={{ fontSize:13, color:"#6b7280", marginTop:6 }}>{bowlingName} need {curRuns+1} to win</div>}
      <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:20 }}>
        {inn === 1 && <button onClick={onEndInnings} style={primaryBtn}>Start 2nd Innings</button>}
        <button onClick={onComplete} style={dangerBtn}>Declare Result</button>
      </div>
    </div>
  );

  return (
    <div style={{ background:"rgba(13,21,32,0.9)", border:"1px solid rgba(16,185,129,0.18)", borderRadius:16, padding:22 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"#10b981", textTransform:"uppercase", letterSpacing:"1.5px" }}>
            Score Entry · {battingName} vs {bowlingName}
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {inn === 1 && !inn1Done && (
            <button onClick={onEndInnings} style={{ fontSize:11, fontWeight:700, color:"#f59e0b", background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.2)", padding:"5px 12px", borderRadius:20, cursor:"pointer" }}>
              End Innings →
            </button>
          )}
          <button onClick={onComplete} style={{ fontSize:11, fontWeight:700, color:"#f87171", background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", padding:"5px 12px", borderRadius:20, cursor:"pointer" }}>
            End Match
          </button>
        </div>
      </div>

      {/* THREE selector cards: Striker, Non-Striker, Bowler */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:20 }}>
        <BatsmanCard
          title="Striker *" subtitle={battingName} color="#10b981" icon="🏏"
          value={strikerId} onChange={setStrikerId}
          players={strikerAvail}
          stats={curBatRows.find((r:any) => r.player_id === strikerId)}
          isStriker={true}
        />
        <BatsmanCard
          title="Non-Striker" subtitle={battingName} color="#60a5fa" icon="🏏"
          value={nonStrikerId} onChange={setNonStrikerId}
          players={nonStrikerAvail}
          stats={curBatRows.find((r:any) => r.player_id === nonStrikerId)}
          isStriker={false}
        />
        <PlayerCard
          title="Bowler" subtitle={bowlingName} color="#f87171" icon="🎯"
          value={bowlerId} onChange={setBowlerId}
          players={bowlingPlayers} allStats={allPlayers}
          statFn={(p:any) => ""}
        />
      </div>

      {/* Delivery details */}
      <div style={{ background:"rgba(255,255,255,0.02)", borderRadius:12, padding:18, border:"1px solid rgba(255,255,255,0.06)", marginBottom:16 }}>
        <div style={{ fontSize:10, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"1px", marginBottom:14 }}>
          Delivery Details
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr", gap:16, marginBottom:14, alignItems:"start" }}>
          {/* Runs off bat */}
          <div>
            <Label>Runs (bat)</Label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {[0,1,2,3,4,5,6].map(r=>(
                <button key={r} onClick={()=>setRunsBat(r)} style={{
                  width:40, height:40, borderRadius:8,
                  border:`2px solid ${runsBat===r ? (r>=6?"#10b981":r>=4?"rgba(16,185,129,0.6)":"rgba(255,255,255,0.4)") : "rgba(255,255,255,0.1)"}`,
                  background: runsBat===r ? (r===6?"rgba(16,185,129,0.3)":r===4?"rgba(16,185,129,0.18)":"rgba(255,255,255,0.15)") : "rgba(255,255,255,0.04)",
                  color: r>=4?"#10b981":"#e2e8f0", fontWeight:800, fontSize:15, cursor:"pointer",
                  fontFamily:"'JetBrains Mono',monospace", transition:"all 0.15s"
                }}>{r}</button>
              ))}
            </div>
          </div>

          {/* Extra type */}
          <div>
            <Label>Extra Type</Label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {EXTRA_TYPES.map(et=>(
                <button key={et} onClick={()=>setExtraType(extraType===et?"":et)} style={{
                  padding:"6px 12px", borderRadius:7,
                  border:`1px solid ${extraType===et?"#f59e0b":"rgba(255,255,255,0.1)"}`,
                  background:extraType===et?"rgba(245,158,11,0.15)":"rgba(255,255,255,0.04)",
                  color:extraType===et?"#f59e0b":"#9ca3af", fontWeight:700, fontSize:12, cursor:"pointer", textTransform:"uppercase"
                }}>
                  {et === "noball" ? "NB" : et === "legbye" ? "LB" : et.charAt(0).toUpperCase() + et.slice(1)}
                </button>
              ))}
            </div>
            {hasExtra && (
              <div style={{ marginTop:8 }}>
                <Label>Extra Runs</Label>
                <div style={{ display:"flex", gap:5 }}>
                  {[1,2,3,4,5].map(n=>(
                    <button key={n} onClick={()=>setExtraRuns(extraRuns===n?0:n)} style={{ width:34, height:34, borderRadius:7, border:`1px solid ${extraRuns===n?"#f59e0b":"rgba(255,255,255,0.1)"}`, background:extraRuns===n?"rgba(245,158,11,0.15)":"rgba(255,255,255,0.04)", color:"#e2e8f0", fontWeight:700, fontSize:13, cursor:"pointer" }}>{n}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Wicket */}
          <div>
            <Label>Wicket</Label>
            <button onClick={()=>{setIsWicket(!isWicket); if(isWicket){setDismissal("");setFielderId("");setOutBatsmanId("");}}} style={{
              width:"100%", padding:"9px", borderRadius:9,
              border:`2px solid ${isWicket?"rgba(239,68,68,0.6)":"rgba(255,255,255,0.1)"}`,
              background:isWicket?"rgba(239,68,68,0.18)":"rgba(255,255,255,0.04)",
              color:isWicket?"#f87171":"#9ca3af",
              fontWeight:800, fontSize:14, cursor:"pointer", transition:"all 0.2s"
            }}>
              {isWicket ? "⚡ WICKET" : "W — Wicket"}
            </button>
            {isWicket && (
              <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:8 }}>
                <div>
                  <Label>How Out</Label>
                  <select style={selStyle} value={dismissal} onChange={e=>setDismissal(e.target.value)}>
                    <option value="">— Select —</option>
                    {DISMISSAL_TYPES.map(d=><option key={d} value={d}>{d.replace(/_/g," ")}</option>)}
                  </select>
                </div>
                {isRunOut && (
                  <div>
                    <Label>Who is Run Out?</Label>
                    <select style={selStyle} value={outBatsmanId} onChange={e=>setOutBatsmanId(Number(e.target.value)||"")}>
                      <option value="">— Select batsman —</option>
                      {[strikerId, nonStrikerId].filter(Boolean).map((id:number) => {
                        const p = props.allPlayers?.find((p:any)=>p.id===id);
                        return p ? <option key={p.id} value={p.id}>{p.name}</option> : null;
                      })}
                    </select>
                  </div>
                )}
                {needsFielder && (
                  <div>
                    <Label>{dismissal==="run_out"?"Fielder":"Catcher/Keeper"}</Label>
                    <select style={selStyle} value={fielderId} onChange={e=>setFielderId(Number(e.target.value)||"")}>
                      <option value="">— Select —</option>
                      {props.bowlingPlayers?.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Summary line */}
        <div style={{ fontSize:12, color:"#6b7280", marginBottom:14, padding:"8px 12px", background:"rgba(255,255,255,0.03)", borderRadius:8 }}>
          📝 This delivery: <strong style={{ color:"#e2e8f0" }}>
            {runsBat} run{runsBat!==1?"s":""} off bat
            {hasExtra ? ` + ${extraRuns||1} ${extraType} extra` : ""}
            {isWicket ? ` + WICKET (${dismissal||"?"})` : ""}
            {isWide ? " — does NOT count as legal delivery" : ""}
            {isNoball ? " — no-ball (free hit next)" : ""}
          </strong>
        </div>

        <button
          onClick={onSubmit}
          disabled={delivering || !strikerId || !nonStrikerId || !bowlerId || (isWicket && !dismissal) || (isRunOut && !outBatsmanId)}
          style={{ ...primaryBtn, width:"100%", justifyContent:"center", opacity:(!strikerId||!nonStrikerId||!bowlerId)?0.4:1, fontSize:14, padding:"11px" }}
        >
          {delivering ? <><Spinner/> Recording…</> : <>Submit Delivery <ChevronRight size={16}/></>}
        </button>
        {(!strikerId || !nonStrikerId || !bowlerId) && (
          <div style={{ textAlign:"center", fontSize:11, color:"#f59e0b", marginTop:8, display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
            <AlertTriangle size={11}/> Select striker, non-striker and bowler to enable scoring
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Batsman card with live stats ─────────────────────────────────────────────
function BatsmanCard({ title, subtitle, color, icon, value, onChange, players, stats, isStriker }: any) {
  return (
    <div style={{ background: value?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.02)", border:`1px solid ${value?color+"50":"rgba(255,255,255,0.08)"}`, borderRadius:12, padding:14, transition:"all 0.2s" }}>
      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
        <span style={{ fontSize:15 }}>{icon}</span>
        <div>
          <div style={{ fontSize:10, fontWeight:800, color, textTransform:"uppercase", letterSpacing:"0.8px" }}>{title}</div>
          <div style={{ fontSize:10, color:"#6b7280" }}>{subtitle}</div>
        </div>
        {isStriker && value && <span style={{ marginLeft:"auto", fontSize:9, fontWeight:800, color:"#10b981", background:"rgba(16,185,129,0.12)", padding:"1px 6px", borderRadius:8 }}>ON STRIKE</span>}
      </div>
      <select style={selStyle} value={value} onChange={(e:any)=>onChange(Number(e.target.value)||"")}>
        <option value="">— Select {title.toLowerCase().replace(" *","")} —</option>
        {players.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {stats && (
        <div style={{ marginTop:8, display:"flex", gap:10, fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>
          <span style={{ fontWeight:900, color:"#f0fdf4", fontSize:18 }}>{stats.runs}</span>
          <span style={{ color:"#6b7280" }}>({stats.balls_faced})</span>
          <span style={{ fontSize:10, color: stats.balls_faced>0&&(stats.runs/stats.balls_faced*100)>=150?"#10b981":"#9ca3af" }}>
            SR {stats.balls_faced>0?(stats.runs/stats.balls_faced*100).toFixed(0):"0"}
          </span>
        </div>
      )}
      {stats && (
        <div style={{ fontSize:10, color:"#6b7280" }}>
          {stats.fours}×4 {stats.sixes}×6
        </div>
      )}
    </div>
  );
}

// ─── Generic player card ──────────────────────────────────────────────────────
function PlayerCard({ title, subtitle, color, icon, value, onChange, players, allStats, statFn }: any) {
  const selected = players.find((p: any) => p.id === value);
  return (
    <div style={{ background: value?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.02)", border:`1px solid ${value?color+"50":"rgba(255,255,255,0.08)"}`, borderRadius:12, padding:14, transition:"all 0.2s" }}>
      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
        <span style={{ fontSize:15 }}>{icon}</span>
        <div>
          <div style={{ fontSize:10, fontWeight:800, color, textTransform:"uppercase", letterSpacing:"0.8px" }}>{title}</div>
          <div style={{ fontSize:10, color:"#6b7280" }}>{subtitle}</div>
        </div>
      </div>
      <select style={selStyle} value={value} onChange={(e:any)=>onChange(Number(e.target.value)||"")}>
        <option value="">— Select {title.toLowerCase()} —</option>
        {players.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {selected && <div style={{ marginTop:6, fontSize:11, color, fontWeight:600 }}>✓ {selected.name}</div>}
    </div>
  );
}

// ─── Current over display ─────────────────────────────────────────────────────
function CurrentOverDisplay({ events, curOvers, overNum }: { events: BallEvent[]; curOvers: string; overNum: number }) {
  if (events.length === 0) return null;
  const legalCount = events.filter(e => !e.extra_type || e.extra_type === "bye" || e.extra_type === "legbye").length;
  return (
    <div style={{ background:"rgba(13,21,32,0.9)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <span style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"1px" }}>Over {overNum + 1} in Progress</span>
        <span style={{ fontSize:11, color:"#6b7280" }}>{legalCount}/6 legal balls</span>
      </div>
      <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
        {events.map((e, i) => {
          const total = e.runs_bat + e.runs_extra;
          const isExtra = !!e.extra_type;
          const label = e.is_wicket ? "W" : isExtra ? `${e.extra_type === "noball" ? "NB" : e.extra_type === "legbye" ? "LB" : e.extra_type?.charAt(0).toUpperCase()}${total>1?total:""}` : String(total);
          const bg = e.is_wicket ? "rgba(239,68,68,0.2)" : e.runs_bat===6 ? "rgba(16,185,129,0.25)" : e.runs_bat===4 ? "rgba(16,185,129,0.15)" : isExtra ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.06)";
          const fg = e.is_wicket ? "#f87171" : e.runs_bat>=4 ? "#10b981" : isExtra ? "#f59e0b" : "#d1d5db";
          const bd = e.is_wicket ? "rgba(239,68,68,0.35)" : e.runs_bat>=4 ? "rgba(16,185,129,0.3)" : isExtra ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)";
          return (
            <div key={i} title={`${e.batsman_name||"?"} | ${e.is_wicket?e.dismissal_type:e.extra_type||`${e.runs_bat}R`}`} style={{ width:38, height:38, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", background:bg, color:fg, border:`1px solid ${bd}`, position:"relative", cursor:"default" }}>
              {label}
            </div>
          );
        })}
        {/* Empty upcoming */}
        {Array.from({length: Math.max(0, 6 - legalCount)}).map((_,i)=>(
          <div key={`e${i}`} style={{ width:38, height:38, borderRadius:9, border:"1px dashed rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"rgba(255,255,255,0.1)" }}/>
          </div>
        ))}
        <div style={{ marginLeft:8, fontSize:13, color:"#6b7280", fontFamily:"'JetBrains Mono',monospace" }}>
          {events.reduce((s,e)=>s+e.runs_bat+e.runs_extra,0)}R {events.filter(e=>e.is_wicket).length>0?`${events.filter(e=>e.is_wicket).length}W`:""}
        </div>
      </div>
    </div>
  );
}

// ─── Over summary bar (RPO per over) ─────────────────────────────────────────
function OverSummaryBar({ events, totalBalls }: { events: BallEvent[]; totalBalls: number }) {
  const completedOvers = Math.floor(totalBalls / 6);
  if (completedOvers < 2) return null;

  const overData = Array.from({ length: completedOvers }, (_, ov) => {
    const balls = events.filter(e => e.over_num === ov);
    const runs = balls.reduce((s, e) => s + e.runs_bat + e.runs_extra, 0);
    const wkts = balls.filter(e => e.is_wicket).length;
    return { name: `${ov + 1}`, runs, wkts };
  });

  return (
    <div style={{ background:"rgba(13,21,32,0.9)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 20px" }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"1px", marginBottom:14 }}>Runs Per Over</div>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={overData} barCategoryGap="15%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
          <XAxis dataKey="name" stroke="#374151" tick={{ fill:"#6b7280", fontSize:10 }} axisLine={false} tickLine={false}/>
          <YAxis stroke="#374151" tick={{ fill:"#6b7280", fontSize:10 }} axisLine={false} tickLine={false} width={20}/>
          <Tooltip
            contentStyle={{ background:"#0d1520", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:12 }}
            labelStyle={{ color:"#e2e8f0", fontWeight:700 }}
            formatter={(val: any, name: string) => [val, name === "runs" ? "Runs" : "Wickets"]}
          />
          <Bar dataKey="runs" fill="#10b981" radius={[3,3,0,0]} name="runs"/>
          <Bar dataKey="wkts" fill="#ef4444" radius={[3,3,0,0]} name="wkts"/>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Ball by ball display ─────────────────────────────────────────────────────
function BallByBallDisplay({ inn1Events, inn2Events, match }: { inn1Events: BallEvent[]; inn2Events: BallEvent[]; match: Match }) {
  const [showInn, setShowInn] = useState<1|2>(match.current_innings as 1|2);
  const events = showInn === 1 ? inn1Events : inn2Events;
  if (inn1Events.length === 0 && inn2Events.length === 0) return null;

  const overs: Record<number, BallEvent[]> = {};
  events.forEach(e => { if (!overs[e.over_num]) overs[e.over_num] = []; overs[e.over_num].push(e); });
  const overNums = Object.keys(overs).map(Number).sort((a,b)=>b-a);

  return (
    <div style={{ background:"rgba(13,21,32,0.9)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"18px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <span style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"1px" }}>Ball by Ball</span>
        {match.inn2_balls > 0 && (
          <div style={{ display:"flex", gap:6 }}>
            {([1,2] as const).map(n=>(
              <button key={n} onClick={()=>setShowInn(n)} style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:20, border:`1px solid ${showInn===n?"#10b981":"rgba(255,255,255,0.1)"}`, background:showInn===n?"rgba(16,185,129,0.15)":"transparent", color:showInn===n?"#10b981":"#6b7280", cursor:"pointer" }}>
                Inn {n}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10, maxHeight:320, overflowY:"auto" }}>
        {overNums.map(ov => {
          const balls = overs[ov];
          const runs = balls.reduce((s,e)=>s+e.runs_bat+e.runs_extra, 0);
          const wkts = balls.filter(e=>e.is_wicket).length;
          return (
            <div key={ov} style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
              <div style={{ width:62, flexShrink:0 }}>
                <div style={{ fontSize:11, color:"#6b7280", fontFamily:"'JetBrains Mono',monospace" }}>Ov {ov+1}</div>
                <div style={{ fontSize:10, color:"#4b5563" }}>{runs}R{wkts>0?` ${wkts}W`:""}</div>
              </div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {balls.map((e,j) => {
                  const total = e.runs_bat + e.runs_extra;
                  const isExt = !!e.extra_type;
                  const lbl = e.is_wicket ? "W" : isExt ? (e.extra_type==="wide"?"Wd":e.extra_type==="noball"?"NB":e.extra_type==="bye"?"B":"LB") : String(total);
                  return (
                    <span key={j} title={`${e.batsman_name||"?"} off ${e.bowler_name||"?"}`} style={{ width:30, height:30, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", background: e.is_wicket?"rgba(239,68,68,0.2)":isExt?"rgba(245,158,11,0.15)":e.runs_bat>=4?"rgba(16,185,129,0.18)":"rgba(255,255,255,0.06)", color:e.is_wicket?"#f87171":isExt?"#f59e0b":e.runs_bat>=4?"#10b981":"#d1d5db", border:`1px solid ${e.is_wicket?"rgba(239,68,68,0.3)":isExt?"rgba(245,158,11,0.2)":e.runs_bat>=4?"rgba(16,185,129,0.3)":"rgba(255,255,255,0.07)"}` }}>
                      {lbl}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Scorecard innings ────────────────────────────────────────────────────────
function ScorecardInnings({ title, batting, bowling, runs, wkts, overs, wides, noballs, byes, legbyes, extras }: any) {
  return (
    <div style={{ background:"rgba(13,21,32,0.9)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, overflow:"hidden" }}>
      <div style={{ padding:"14px 20px", background:"rgba(16,185,129,0.06)", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:13, fontWeight:800, color:"#f0fdf4" }}>{title}</span>
        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:24, fontWeight:900, color:"#f0fdf4" }}>
          {runs}/{wkts} <span style={{ fontSize:13, color:"#6b7280", fontWeight:400 }}>({overs} ov)</span>
        </span>
      </div>

      {batting.length > 0 && (
        <>
          <div style={{ padding:"7px 20px", background:"rgba(255,255,255,0.02)", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize:10, fontWeight:700, color:"#10b981", textTransform:"uppercase", letterSpacing:"1px" }}>🏏 Batting</span>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"rgba(255,255,255,0.02)" }}>
                {["Batter","","R","B","4s","6s","SR"].map((h,i)=>(
                  <th key={i} style={{ padding:"7px 12px", fontSize:10, fontWeight:700, textTransform:"uppercase", color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.04)", textAlign:i<=1?"left":"right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batting.map((row: BattingRow) => {
                const sr = row.balls_faced > 0 ? ((row.runs / row.balls_faced) * 100).toFixed(1) : "—";
                const isMilestone = row.runs >= 50;
                return (
                  <tr key={row.player_id} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}
                    onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.02)")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                    <td style={{ padding:"10px 12px", fontWeight:700, color:"#e2e8f0", fontSize:13 }}>
                      {row.player_name}
                      {!row.is_out && <span style={{ marginLeft:6, fontSize:10, color:"#10b981" }}>*</span>}
                    </td>
                    <td style={{ padding:"10px 12px", fontSize:11, color:"#6b7280", maxWidth:200 }}>{dismissalText(row)}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", fontSize:15, fontWeight:900, color:row.runs>=100?"#f59e0b":row.runs>=50?"#60a5fa":"#f0fdf4" }}>
                      {row.runs}{row.runs>=100?"★":""}
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:"#9ca3af", fontSize:12 }}>{row.balls_faced}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:"#60a5fa", fontSize:12 }}>{row.fours}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:"#10b981", fontSize:12 }}>{row.sixes}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:Number(sr)>=150?"#10b981":Number(sr)>=100?"#60a5fa":"#9ca3af" }}>{sr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding:"8px 14px", display:"flex", gap:16, fontSize:12, color:"#6b7280", borderTop:"1px solid rgba(255,255,255,0.04)", background:"rgba(255,255,255,0.01)" }}>
            <span>Extras: <strong style={{ color:"#e2e8f0" }}>{extras}</strong></span>
            <span>W: {wides}</span><span>NB: {noballs}</span><span>B: {byes}</span><span>LB: {legbyes}</span>
          </div>
          <div style={{ padding:"8px 14px", display:"flex", gap:6, fontSize:13, fontWeight:800, color:"#f0fdf4", borderTop:"1px solid rgba(255,255,255,0.04)" }}>
            <span>Total:</span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace" }}>{runs}/{wkts} ({overs} ov)</span>
          </div>
        </>
      )}

      {bowling.length > 0 && (
        <>
          <div style={{ padding:"7px 20px", background:"rgba(255,255,255,0.02)", borderTop:"1px solid rgba(255,255,255,0.05)", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize:10, fontWeight:700, color:"#f87171", textTransform:"uppercase", letterSpacing:"1px" }}>🎯 Bowling</span>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"rgba(255,255,255,0.02)" }}>
                {["Bowler","O","M","R","W","Econ","WD","NB"].map((h,i)=>(
                  <th key={i} style={{ padding:"7px 12px", fontSize:10, fontWeight:700, textTransform:"uppercase", color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.04)", textAlign:i===0?"left":"right" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bowling.map((row: BowlingRow) => {
                const ov = `${Math.floor(row.balls_bowled/6)}.${row.balls_bowled%6}`;
                const econ = row.balls_bowled > 0 ? ((row.runs_conceded / row.balls_bowled) * 6).toFixed(2) : "—";
                return (
                  <tr key={row.player_id} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}
                    onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.02)")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                    <td style={{ padding:"10px 12px", fontWeight:700, color:"#e2e8f0", fontSize:13 }}>
                      {row.player_name}
                      {row.wickets >= 5 && <span style={{ marginLeft:6, fontSize:10, color:"#f87171" }}>🔥</span>}
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:"#9ca3af", fontSize:12 }}>{ov}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:"#6b7280", fontSize:12 }}>{row.maidens}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:"#9ca3af", fontSize:12 }}>{row.runs_conceded}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", fontSize:15, fontWeight:900, color:row.wickets>0?"#f87171":"#4b5563" }}>{row.wickets}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:Number(econ)<=6?"#10b981":Number(econ)<=9?"#f59e0b":"#f87171" }}>{econ}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:"#6b7280", fontSize:12 }}>{row.wides}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:"#6b7280", fontSize:12 }}>{row.no_balls}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ─── Fall of Wickets Tab ──────────────────────────────────────────────────────
function FallOfWicketsTab({ inn1Events, inn2Events, match, inn1BatName, inn2BatName }: any) {
  const [showInn, setShowInn] = useState<1|2>(1);
  const events = showInn === 1 ? inn1Events : inn2Events;
  const batName = showInn === 1 ? inn1BatName : inn2BatName;

  const wickets = events.filter((e: BallEvent) => e.is_wicket);
  let runningRuns = 0;
  const rows: { wkt: number; runs: number; overs: string; batsman: string; how: string }[] = [];

  for (const e of events) {
    runningRuns += e.runs_bat + e.runs_extra;
    if (e.is_wicket) {
      rows.push({
        wkt: rows.length + 1,
        runs: runningRuns,
        overs: `${e.over_num}.${e.ball_num + 1}`,
        batsman: e.batsman_name || "?",
        how: e.dismissal_type?.replace(/_/g, " ") || "out",
      });
    }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {match.inn2_balls > 0 && (
        <div style={{ display:"flex", gap:6 }}>
          {([1,2] as const).map(n=>(
            <button key={n} onClick={()=>setShowInn(n)} style={{ fontSize:12, fontWeight:700, padding:"5px 14px", borderRadius:20, border:`1px solid ${showInn===n?"#10b981":"rgba(255,255,255,0.1)"}`, background:showInn===n?"rgba(16,185,129,0.15)":"transparent", color:showInn===n?"#10b981":"#6b7280", cursor:"pointer" }}>
              Innings {n}
            </button>
          ))}
        </div>
      )}

      <div style={{ background:"rgba(13,21,32,0.9)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, overflow:"hidden" }}>
        <div style={{ padding:"12px 20px", background:"rgba(239,68,68,0.06)", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize:13, fontWeight:800, color:"#f0fdf4" }}>Fall of Wickets — {batName}</span>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding:"40px 24px", textAlign:"center", color:"#374151", fontSize:14 }}>No wickets yet</div>
        ) : (
          <>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"rgba(255,255,255,0.02)" }}>
                  {["Wkt","Score","Over","Batsman","How Out"].map((h,i)=>(
                    <th key={i} style={{ padding:"8px 16px", fontSize:10, fontWeight:700, textTransform:"uppercase", color:"#4b5563", borderBottom:"1px solid rgba(255,255,255,0.04)", textAlign:i>1?"left":"center" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.wkt} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }}
                    onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.02)")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                    <td style={{ padding:"10px 16px", textAlign:"center" }}>
                      <span style={{ width:26, height:26, display:"inline-flex", alignItems:"center", justifyContent:"center", borderRadius:7, background:"rgba(239,68,68,0.15)", color:"#f87171", fontSize:12, fontWeight:800 }}>{r.wkt}</span>
                    </td>
                    <td style={{ padding:"10px 16px", textAlign:"center", fontFamily:"'JetBrains Mono',monospace", fontWeight:800, color:"#f0fdf4", fontSize:14 }}>{r.runs}</td>
                    <td style={{ padding:"10px 16px", fontFamily:"'JetBrains Mono',monospace", color:"#6b7280", fontSize:12 }}>{r.overs}</td>
                    <td style={{ padding:"10px 16px", fontWeight:700, color:"#e2e8f0", fontSize:13 }}>{r.batsman}</td>
                    <td style={{ padding:"10px 16px", color:"#9ca3af", fontSize:12, textTransform:"capitalize" }}>{r.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Wicket progression chart */}
            <div style={{ padding:"16px 20px", borderTop:"1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"1px", marginBottom:12 }}>Wicket Progression</div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:60 }}>
                {rows.map((r,i) => {
                  const maxRuns = rows[rows.length-1]?.runs || 1;
                  const h = Math.max(8, (r.runs / maxRuns) * 56);
                  return (
                    <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                      <div style={{ fontSize:9, color:"#ef4444", fontWeight:700 }}>{r.runs}</div>
                      <div style={{ width:"100%", height:h, background:`rgba(239,68,68,${0.15+i*0.07})`, borderRadius:"3px 3px 0 0", border:"1px solid rgba(239,68,68,0.3)" }}/>
                      <div style={{ fontSize:9, color:"#6b7280" }}>W{r.wkt}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────
function StatsTab({ inn1Bat, inn2Bat, inn1Bowl, inn2Bowl, match, inn1Events, inn2Events }: any) {
  const [sel, setSel] = useState<"batting"|"bowling"|"runrate">("batting");
  const allBat  = [...inn1Bat, ...inn2Bat];
  const allBowl = [...inn1Bowl, ...inn2Bowl];

  const rrChart = [
    { name: match.team_a_name.split(" ")[0], rr: match.inn1_balls>0 ? +((match.inn1_runs/match.inn1_balls)*6).toFixed(2):0 },
    { name: match.team_b_name.split(" ")[0], rr: match.inn2_balls>0 ? +((match.inn2_runs/match.inn2_balls)*6).toFixed(2):0 },
  ];

  const topBat = [...allBat].sort((a,b)=>b.runs-a.runs).slice(0,8).map(p=>({
    name: p.player_name.split(" ").pop(),
    R: p.runs, B: p.balls_faced,
    SR: p.balls_faced>0?+((p.runs/p.balls_faced)*100).toFixed(0):0,
    "4s": p.fours, "6s": p.sixes,
  }));

  const topBowl = [...allBowl].sort((a,b)=>b.wickets-a.wickets||a.runs_conceded-b.runs_conceded).slice(0,8).map(p=>({
    name: p.player_name.split(" ").pop(),
    W: p.wickets,
    Econ: p.balls_bowled>0?+((p.runs_conceded/p.balls_bowled)*6).toFixed(2):0,
    Ov: `${Math.floor(p.balls_bowled/6)}.${p.balls_bowled%6}`,
  }));

  // Progressive run rate
  const buildRRLine = (events: BallEvent[]) => {
    let runs = 0, balls = 0;
    const pts: { over: string; rr: number }[] = [];
    const sorted = [...events].sort((a,b)=>a.over_num!==b.over_num?a.over_num-b.over_num:a.ball_num-b.ball_num);
    for (const e of sorted) {
      runs += e.runs_bat + e.runs_extra;
      if (!e.extra_type || e.extra_type === "bye" || e.extra_type === "legbye") balls++;
      if (balls > 0 && balls % 6 === 0) {
        pts.push({ over: `${balls/6}`, rr: +((runs/balls)*6).toFixed(2) });
      }
    }
    return pts;
  };

  const rrLine1 = buildRRLine(inn1Events);
  const rrLine2 = buildRRLine(inn2Events);
  const maxLen = Math.max(rrLine1.length, rrLine2.length);
  const rrMerged = Array.from({ length: maxLen }, (_, i) => ({
    over: String(i + 1),
    Inn1: rrLine1[i]?.rr || null,
    Inn2: rrLine2[i]?.rr || null,
  }));

  if (allBat.length === 0) return <div style={{ textAlign:"center", padding:"60px 24px", color:"#374151", fontSize:14 }}>No stats available yet.</div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* RR comparison */}
      <Card title="Run Rate Comparison">
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={rrChart} barCategoryGap="45%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false}/>
            <XAxis dataKey="name" stroke="#4b5563" tick={{ fill:"#9ca3af", fontSize:12 }}/>
            <YAxis stroke="#4b5563" tick={{ fill:"#9ca3af", fontSize:11 }}/>
            <Tooltip contentStyle={{ background:"#0d1520", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8 }} labelStyle={{ color:"#e2e8f0", fontWeight:700 }}/>
            <Bar dataKey="rr" fill="#10b981" radius={[6,6,0,0]} name="Run Rate"/>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Toggle */}
      <div style={{ display:"flex", gap:2, background:"rgba(255,255,255,0.04)", borderRadius:10, padding:3, alignSelf:"flex-start" }}>
        {(["batting","bowling","runrate"] as const).map(s=>(
          <button key={s} onClick={()=>setSel(s)} style={{ padding:"7px 16px", borderRadius:8, border:"none", fontSize:12, fontWeight:700, cursor:"pointer", background:sel===s?"#10b981":"transparent", color:sel===s?"white":"#6b7280", fontFamily:"'Barlow',sans-serif" }}>
            {s === "runrate" ? "Run Rate" : s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      {sel === "batting" && topBat.length > 0 && (
        <Card title="Top Batting Performances">
          <ResponsiveContainer width="100%" height={Math.max(160, topBat.length*32)}>
            <BarChart data={topBat} layout="vertical" barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false}/>
              <XAxis type="number" stroke="#4b5563" tick={{ fill:"#9ca3af", fontSize:11 }}/>
              <YAxis dataKey="name" type="category" stroke="#4b5563" tick={{ fill:"#9ca3af", fontSize:11 }} width={60}/>
              <Tooltip contentStyle={{ background:"#0d1520", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8 }} labelStyle={{ color:"#e2e8f0", fontWeight:700 }}/>
              <Legend wrapperStyle={{ color:"#9ca3af", fontSize:11 }}/>
              <Bar dataKey="R" fill="#10b981" radius={[0,4,4,0]} name="Runs"/>
              <Bar dataKey="SR" fill="#a78bfa" radius={[0,4,4,0]} name="Strike Rate"/>
              <Bar dataKey="4s" fill="#60a5fa" radius={[0,4,4,0]} name="4s"/>
              <Bar dataKey="6s" fill="#f59e0b" radius={[0,4,4,0]} name="6s"/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {sel === "bowling" && topBowl.length > 0 && (
        <Card title="Bowling Figures">
          <ResponsiveContainer width="100%" height={Math.max(160, topBowl.length*32)}>
            <BarChart data={topBowl} layout="vertical" barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false}/>
              <XAxis type="number" stroke="#4b5563" tick={{ fill:"#9ca3af", fontSize:11 }}/>
              <YAxis dataKey="name" type="category" stroke="#4b5563" tick={{ fill:"#9ca3af", fontSize:11 }} width={60}/>
              <Tooltip contentStyle={{ background:"#0d1520", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8 }} labelStyle={{ color:"#e2e8f0", fontWeight:700 }}/>
              <Legend wrapperStyle={{ color:"#9ca3af", fontSize:11 }}/>
              <Bar dataKey="W" fill="#f87171" radius={[0,4,4,0]} name="Wickets"/>
              <Bar dataKey="Econ" fill="#f59e0b" radius={[0,4,4,0]} name="Economy"/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {sel === "runrate" && rrMerged.length > 0 && (
        <Card title="Progressive Run Rate">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={rrMerged}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)"/>
              <XAxis dataKey="over" stroke="#4b5563" tick={{ fill:"#9ca3af", fontSize:11 }} label={{ value:"Over", fill:"#4b5563", fontSize:10, position:"insideBottom", offset:-2 }}/>
              <YAxis stroke="#4b5563" tick={{ fill:"#9ca3af", fontSize:11 }}/>
              <Tooltip contentStyle={{ background:"#0d1520", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8 }} labelStyle={{ color:"#e2e8f0", fontWeight:700 }}/>
              <Legend wrapperStyle={{ color:"#9ca3af", fontSize:11 }}/>
              <Line type="monotone" dataKey="Inn1" stroke="#10b981" strokeWidth={2} dot={false} name="Inn 1 RR" connectNulls/>
              <Line type="monotone" dataKey="Inn2" stroke="#60a5fa" strokeWidth={2} dot={false} name="Inn 2 RR" connectNulls/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────
function AnalysisPanel({ analysis, aiLoad, onGenerate }: any) {
  return (
    <div style={{ background:"rgba(13,21,32,0.9)", border:"1px solid rgba(167,139,250,0.18)", borderRadius:16, padding:22 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:analysis?18:0 }}>
        <span style={{ fontSize:11, fontWeight:700, color:"#a78bfa", textTransform:"uppercase", letterSpacing:"1.5px" }}>AI Analysis</span>
        <button onClick={onGenerate} disabled={aiLoad} style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"7px 16px", borderRadius:8, border:"1px solid rgba(167,139,250,0.25)", background:"rgba(167,139,250,0.1)", color:"#a78bfa", fontSize:13, fontWeight:700, cursor:"pointer", opacity:aiLoad?0.6:1, fontFamily:"'Barlow',sans-serif" }}>
          <Sparkles size={13}/> {aiLoad?"Analyzing…":"Generate"}
        </button>
      </div>
      {analysis && (
        <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:8 }}>
          {analysis.replace(/\*\*/g,"").replace(/\*/g,"").replace(/#{1,6}\s?/g,"").replace(/`/g,"")
            .split("\n").map((l:string)=>l.trim()).filter((l:string)=>l.length>0)
            .map((line:string, i:number) => {
              const sec = /^\d+[\)\.\:]/.test(line);
              return <p key={i} style={{ margin:0, fontSize:sec?11.5:14, fontWeight:sec?800:400, color:sec?"#c4b5fd":"#d1d5db", lineHeight:sec?1.4:1.75, textTransform:sec?"uppercase":"none" as any, paddingTop:sec&&i>0?8:0 }}>{line}</p>;
            })}
        </div>
      )}
    </div>
  );
}

// ─── Utility components ───────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background:"rgba(13,21,32,0.9)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:22 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"1.5px", marginBottom:16 }}>{title}</div>
      {children}
    </div>
  );
}
function Chip({ c, pulse, children }: { c: string; pulse?: boolean; children: React.ReactNode }) {
  return <span style={{ fontSize:9, fontWeight:800, color:c, background:`${c}15`, border:`1px solid ${c}30`, padding:"2px 8px", borderRadius:20, textTransform:"uppercase", letterSpacing:"0.5px", animation:pulse?"blink 2s infinite":"none" }}>{children}</span>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize:10.5, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:6 }}>{children}</div>;
}
function Spinner() {
  return <div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid #10b981", borderTopColor:"transparent", animation:"spin 0.8s linear infinite", flexShrink:0 }}/>;
}
function Modal({ title, onClose, children }: { title: string; onClose: ()=>void; children: React.ReactNode }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, backdropFilter:"blur(8px)" }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:"#0d1520", border:"1px solid rgba(255,255,255,0.12)", borderRadius:18, padding:28, width:"100%", maxWidth:400, boxShadow:"0 24px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize:16, fontWeight:800, color:"#f0fdf4", marginBottom:20, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase" }}>{title}</div>
        {children}
      </div>
    </div>
  );
}
function StatusBadge({ status }: { status: string }) {
  const cfg: any = { live:{bg:"rgba(239,68,68,0.12)",c:"#f87171",b:"rgba(239,68,68,0.25)"}, scheduled:{bg:"rgba(96,165,250,0.1)",c:"#93c5fd",b:"rgba(96,165,250,0.2)"}, completed:{bg:"rgba(107,114,128,0.12)",c:"#9ca3af",b:"rgba(107,114,128,0.2)"} };
  const s = cfg[status]??cfg.scheduled;
  return <span style={{ padding:"3px 10px", borderRadius:6, fontSize:10.5, fontWeight:700, textTransform:"uppercase" as const, background:s.bg, color:s.c, border:`1px solid ${s.b}` }}>{status}</span>;
}

const selStyle: React.CSSProperties = { width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)", color:"#f0fdf4", fontSize:13, outline:"none", fontFamily:"'Barlow',sans-serif", cursor:"pointer", boxSizing:"border-box" as const };
const primaryBtn: React.CSSProperties = { display:"inline-flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#10b981,#059669)", color:"white", fontSize:14, fontWeight:800, cursor:"pointer", boxShadow:"0 2px 8px rgba(16,185,129,0.3)", fontFamily:"'Barlow',sans-serif" };
const dangerBtn: React.CSSProperties  = { display:"inline-flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"1px solid rgba(239,68,68,0.3)", background:"rgba(239,68,68,0.1)", color:"#f87171", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"'Barlow',sans-serif" };
const ghostBtn: React.CSSProperties   = { display:"inline-flex", alignItems:"center", gap:7, padding:"10px 22px", borderRadius:10, border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.05)", color:"#9ca3af", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Barlow',sans-serif" };