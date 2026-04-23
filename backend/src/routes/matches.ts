import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { broadcastScore } from "../ws.js";
import { chatCompletion } from "../services/groq.js";
import { requireAuth, requireRole } from "../middleware/auth_middleware.js";

export const matches = Router();

// ─── Overs helper: balls → "X.Y" cricket format ──────────────────────────────
function ballsToOvers(balls: number): string {
  const ov = Math.floor(balls / 6);
  const b  = balls % 6;
  return `${ov}.${b}`;
}

// ─── Build match summary object from DB row ───────────────────────────────────
function buildMatch(m: any) {
  const inn1Extras = m.inn1_wides + m.inn1_noballs + m.inn1_byes + m.inn1_legbyes;
  const inn2Extras = m.inn2_wides + m.inn2_noballs + m.inn2_byes + m.inn2_legbyes;
  return {
    id:               m.id,
    tournament_id:    m.tournament_id,
    team_a_id:        m.team_a_id,
    team_b_id:        m.team_b_id,
    team_a_name:      m.team_a_name,
    team_b_name:      m.team_b_name,
    scheduled_at:     m.scheduled_at,
    venue:            m.venue,
    toss_winner_id:   m.toss_winner_id,
    toss_decision:    m.toss_decision,
    status:           m.status,
    current_innings:  m.current_innings,

    inn1_batting_team_id: m.inn1_batting_team_id,
    inn1_runs:     m.inn1_runs,
    inn1_wickets:  m.inn1_wickets,
    inn1_balls:    m.inn1_balls,
    inn1_overs:    ballsToOvers(m.inn1_balls),
    inn1_extras:   inn1Extras,
    inn1_wides:    m.inn1_wides,
    inn1_noballs:  m.inn1_noballs,
    inn1_byes:     m.inn1_byes,
    inn1_legbyes:  m.inn1_legbyes,

    inn2_batting_team_id: m.inn2_batting_team_id,
    inn2_runs:     m.inn2_runs,
    inn2_wickets:  m.inn2_wickets,
    inn2_balls:    m.inn2_balls,
    inn2_overs:    ballsToOvers(m.inn2_balls),
    inn2_extras:   inn2Extras,
    inn2_wides:    m.inn2_wides,
    inn2_noballs:  m.inn2_noballs,
    inn2_byes:     m.inn2_byes,
    inn2_legbyes:  m.inn2_legbyes,

    winner_id:   m.winner_id,
    win_margin:  m.win_margin,
    win_type:    m.win_type,
  };
}

const SEL = `
  SELECT m.*, ta.name AS team_a_name, tb.name AS team_b_name
  FROM matches m
  JOIN teams ta ON ta.id = m.team_a_id
  JOIN teams tb ON tb.id = m.team_b_id
`;

async function getMatch(id: string | number) {
  const rows = await query(`${SEL} WHERE m.id=$1`, [id]);
  if (!rows[0]) return null;
  return buildMatch(rows[0]);
}

// ─── Helper: auto-complete match and return updated match ─────────────────────
async function autoCompleteMatch(matchId: string | number, m: any): Promise<any> {
  const inn1BatId = m.inn1_batting_team_id;
  const inn2BatId = m.inn2_batting_team_id;
  const inn1Runs  = m.inn1_runs;
  const inn2Runs  = m.inn2_runs;
  const inn2Wkts  = m.inn2_wickets;

  let winnerId: number | null = null;
  let winMargin: number | null = null;
  let winType = "runs";

  if (inn2Runs > inn1Runs) {
    // Inn2 batting team won — by wickets remaining
    winnerId  = inn2BatId;
    winMargin = 10 - inn2Wkts;
    winType   = "wickets";
  } else if (inn1Runs > inn2Runs) {
    // Inn1 batting team won — by runs
    winnerId  = inn1BatId;
    winMargin = inn1Runs - inn2Runs;
    winType   = "runs";
  } else {
    winType = "tie";
  }

  await query(
    `UPDATE matches SET status='completed', winner_id=$1, win_margin=$2, win_type=$3 WHERE id=$4`,
    [winnerId, winMargin, winType, matchId]
  );

  return getMatch(matchId);
}

// ─── GET /api/matches ─────────────────────────────────────────────────────────
matches.get("/", async (_req, res) => {
  try {
    const rows = await query(`${SEL} ORDER BY m.scheduled_at`);
    res.json(rows.map(buildMatch));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── GET /api/matches/:id ─────────────────────────────────────────────────────
matches.get("/:id", async (req, res) => {
  try {
    const m = await getMatch(req.params.id);
    if (!m) return res.status(404).json({ error: "not found" });
    res.json(m);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/matches/:id/toss ───────────────────────────────────────────────
matches.post("/:id/toss", requireAuth, requireRole("admin", "scorer"), async (req, res) => {
  const { toss_winner_id, toss_decision } = req.body;
  if (!["bat", "bowl"].includes(toss_decision)) {
    return res.status(400).json({ error: "toss_decision must be bat or bowl" });
  }
  try {
    const rows = await query("SELECT * FROM matches WHERE id=$1", [req.params.id]);
    const m = rows[0];
    if (!m) return res.status(404).json({ error: "not found" });

    const inn1BatId = toss_decision === "bat" ? toss_winner_id
      : (toss_winner_id === m.team_a_id ? m.team_b_id : m.team_a_id);
    const inn2BatId = inn1BatId === m.team_a_id ? m.team_b_id : m.team_a_id;

    await query(
      `UPDATE matches SET toss_winner_id=$1, toss_decision=$2,
       inn1_batting_team_id=$3, inn2_batting_team_id=$4 WHERE id=$5`,
      [toss_winner_id, toss_decision, inn1BatId, inn2BatId, req.params.id]
    );
    res.json(await getMatch(req.params.id));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/matches/:id/start ─────────────────────────────────────────────
matches.post("/:id/start", requireAuth, requireRole("admin", "scorer"), async (req, res) => {
  try {
    const rows = await query("SELECT * FROM matches WHERE id=$1", [req.params.id]);
    const m = rows[0];
    if (!m) return res.status(404).json({ error: "not found" });

    const inn1Bat = m.inn1_batting_team_id || m.team_a_id;
    const inn2Bat = inn1Bat === m.team_a_id ? m.team_b_id : m.team_a_id;

    await query(
      `UPDATE matches SET status='live', current_innings=1,
       inn1_batting_team_id=$1, inn2_batting_team_id=$2 WHERE id=$3`,
      [inn1Bat, inn2Bat, req.params.id]
    );
    const updated = await getMatch(req.params.id);
    broadcastScore(Number(req.params.id), updated);
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Delivery schema ──────────────────────────────────────────────────────────
const deliverySchema = z.object({
  batsman_id:    z.number().int(),
  bowler_id:     z.number().int(),
  runs_bat:      z.number().int().min(0).max(6).default(0),
  extra_type:    z.enum(["wide","noball","bye","legbye"]).optional(),
  extra_runs:    z.number().int().min(0).max(5).default(0),
  is_wicket:     z.boolean().default(false),
  dismissal_type: z.enum(["bowled","caught","lbw","run_out","stumped","hit_wicket","retired_hurt"]).optional(),
  fielder_id:    z.number().int().optional(),
  out_batsman_id: z.number().int().optional(),
});

// ─── POST /api/matches/:id/delivery ──────────────────────────────────────────
matches.post("/:id/delivery", requireAuth, requireRole("admin", "scorer"), async (req, res) => {
  const parsed = deliverySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { batsman_id, bowler_id, runs_bat, extra_type, extra_runs, is_wicket, dismissal_type, fielder_id, out_batsman_id } = parsed.data;

  try {
    const rows = await query("SELECT * FROM matches WHERE id=$1", [req.params.id]);
    const m = rows[0];
    if (!m) return res.status(404).json({ error: "not found" });
    if (m.status !== "live") return res.status(400).json({ error: "Match is not live" });

    const inn = m.current_innings as 1 | 2;
    const innPfx = `inn${inn}`;

    const isLegal = !extra_type || (extra_type === "bye") || (extra_type === "legbye");
    const bowlerBall = extra_type === "wide" ? 0 : 1;
    const matchBall = isLegal ? 1 : 0;

    const currentBalls = m[`${innPfx}_balls`] as number;
    const overNum  = Math.floor(currentBalls / 6);
    const ballNum  = currentBalls % 6;

    const totalRuns = runs_bat + extra_runs;

    const wicketDelta = is_wicket ? 1 : 0;

    let extraCols = "";
    if (extra_type === "wide")   extraCols = `, ${innPfx}_wides=${innPfx}_wides+${extra_runs || 1}`;
    if (extra_type === "noball") extraCols = `, ${innPfx}_noballs=${innPfx}_noballs+1`;
    if (extra_type === "bye")    extraCols = `, ${innPfx}_byes=${innPfx}_byes+${extra_runs}`;
    if (extra_type === "legbye") extraCols = `, ${innPfx}_legbyes=${innPfx}_legbyes+${extra_runs}`;

    await query(
      `UPDATE matches SET
        ${innPfx}_runs    = ${innPfx}_runs    + $1,
        ${innPfx}_wickets = ${innPfx}_wickets + $2,
        ${innPfx}_balls   = ${innPfx}_balls   + $3
        ${extraCols}
       WHERE id=$4`,
      [totalRuns, wicketDelta, matchBall, req.params.id]
    );

    // ─── Insert ball event ────────────────────────────────────────────────────
    await query(
      `INSERT INTO ball_events
        (match_id, innings_num, over_num, ball_num, batsman_id, bowler_id,
         runs_bat, runs_extra, extra_type, is_wicket, dismissal_type, fielder_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [req.params.id, inn, overNum, ballNum, batsman_id, bowler_id,
       runs_bat, extra_runs, extra_type || null, is_wicket, dismissal_type || null, fielder_id || null]
    );

    // ─── Batting stats ────────────────────────────────────────────────────────
    if (!extra_type || extra_type === "noball") {
      await query(
        `INSERT INTO batting_stats (match_id, innings_num, player_id, runs, balls_faced, fours, sixes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (match_id, innings_num, player_id) DO UPDATE SET
           runs        = batting_stats.runs + $4,
           balls_faced = batting_stats.balls_faced + $5,
           fours       = batting_stats.fours + $6,
           sixes       = batting_stats.sixes + $7`,
        [req.params.id, inn, batsman_id, runs_bat,
         1,
         runs_bat === 4 ? 1 : 0,
         runs_bat === 6 ? 1 : 0]
      );
    }

    // ─── Mark batsman out ─────────────────────────────────────────────────────
    if (is_wicket) {
      const outBatsmanId = dismissal_type === "run_out"
        ? (out_batsman_id || batsman_id)
        : batsman_id;
      await query(
        `INSERT INTO batting_stats (match_id, innings_num, player_id, is_out, dismissal_type, dismissed_by, fielder_id)
         VALUES ($1,$2,$3,TRUE,$4,$5,$6)
         ON CONFLICT (match_id, innings_num, player_id) DO UPDATE SET
           is_out         = TRUE,
           dismissal_type = $4,
           dismissed_by   = $5,
           fielder_id     = $6`,
        [req.params.id, inn, outBatsmanId, dismissal_type || null,
         ["bowled","caught","lbw","stumped","hit_wicket"].includes(dismissal_type || "") ? bowler_id : null,
         fielder_id || null]
      );
    }

    // ─── Bowling stats ────────────────────────────────────────────────────────
    const bowlerWicket = is_wicket && !["run_out"].includes(dismissal_type || "") ? 1 : 0;
    await query(
      `INSERT INTO bowling_stats (match_id, innings_num, player_id, balls_bowled, runs_conceded, wickets, wides, no_balls)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (match_id, innings_num, player_id) DO UPDATE SET
         balls_bowled  = bowling_stats.balls_bowled  + $4,
         runs_conceded = bowling_stats.runs_conceded + $5,
         wickets       = bowling_stats.wickets       + $6,
         wides         = bowling_stats.wides         + $7,
         no_balls      = bowling_stats.no_balls      + $8`,
      [req.params.id, inn, bowler_id,
       bowlerBall,
       totalRuns,
       bowlerWicket,
       extra_type === "wide" ? 1 : 0,
       extra_type === "noball" ? 1 : 0]
    );

    // ─── Check maiden over completion ─────────────────────────────────────────
    const newBalls = currentBalls + matchBall;
    if (matchBall && newBalls % 6 === 0 && newBalls > 0) {
      const overEvents = await query(
        `SELECT SUM(runs_bat + runs_extra) as total
         FROM ball_events
         WHERE match_id=$1 AND innings_num=$2 AND over_num=$3 AND bowler_id=$4`,
        [req.params.id, inn, overNum, bowler_id]
      );
      if (Number(overEvents[0]?.total || 0) === 0) {
        await query(
          `UPDATE bowling_stats SET maidens=maidens+1
           WHERE match_id=$1 AND innings_num=$2 AND player_id=$3`,
          [req.params.id, inn, bowler_id]
        );
      }
    }

    // ─── Fetch updated match state ────────────────────────────────────────────
    const freshRows = await query("SELECT * FROM matches WHERE id=$1", [req.params.id]);
    const fresh = freshRows[0];

    // ─── AUTO-COMPLETE: target achieved in 2nd innings ────────────────────────
    if (inn === 2 && fresh.inn1_runs !== null) {
      const target = fresh.inn1_runs + 1;
      const inn2Runs = fresh.inn2_runs;
      const inn2Wickets = fresh.inn2_wickets;
      const inn2Balls = fresh.inn2_balls;
      const maxBalls = 120; // T20 — adjust if needed based on tournament format

      const targetAchieved = inn2Runs >= target;
      const allOut = inn2Wickets >= 10;
      const oversExhausted = inn2Balls >= maxBalls;

      if (targetAchieved || allOut || oversExhausted) {
        const completed = await autoCompleteMatch(req.params.id, fresh);
        broadcastScore(Number(req.params.id), completed);
        return res.json(completed);
      }
    }

    const updated = await getMatch(req.params.id);
    broadcastScore(Number(req.params.id), updated);
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/matches/:id/end-innings ───────────────────────────────────────
matches.post("/:id/end-innings", requireAuth, requireRole("admin", "scorer"), async (req, res) => {
  try {
    const m = await getMatch(req.params.id);
    if (!m) return res.status(404).json({ error: "not found" });
    if (m.current_innings !== 1) return res.status(400).json({ error: "Already in innings 2" });

    await query("UPDATE matches SET current_innings=2 WHERE id=$1", [req.params.id]);
    const updated = await getMatch(req.params.id);
    broadcastScore(Number(req.params.id), updated);
    res.json(updated);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/matches/:id/complete ──────────────────────────────────────────
matches.post("/:id/complete", requireAuth, requireRole("admin", "scorer"), async (req, res) => {
  try {
    const freshRows = await query("SELECT * FROM matches WHERE id=$1", [req.params.id]);
    const fresh = freshRows[0];
    if (!fresh) return res.status(404).json({ error: "not found" });

    const completed = await autoCompleteMatch(req.params.id, fresh);
    broadcastScore(Number(req.params.id), completed);
    res.json(completed);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── GET /api/matches/:id/innings/:num/batting ───────────────────────────────
matches.get("/:id/innings/:num/batting", async (req, res) => {
  try {
    const rows = await query(
      `SELECT bs.*, p.name AS player_name,
              db.name AS dismissed_by_name, fp.name AS fielder_name
       FROM batting_stats bs
       JOIN players p ON p.id = bs.player_id
       LEFT JOIN players db ON db.id = bs.dismissed_by
       LEFT JOIN players fp ON fp.id = bs.fielder_id
       WHERE bs.match_id=$1 AND bs.innings_num=$2
       ORDER BY bs.batting_position NULLS LAST, bs.id`,
      [req.params.id, req.params.num]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── GET /api/matches/:id/innings/:num/bowling ───────────────────────────────
matches.get("/:id/innings/:num/bowling", async (req, res) => {
  try {
    const rows = await query(
      `SELECT bws.*, p.name AS player_name
       FROM bowling_stats bws
       JOIN players p ON p.id = bws.player_id
       WHERE bws.match_id=$1 AND bws.innings_num=$2
       ORDER BY bws.balls_bowled DESC`,
      [req.params.id, req.params.num]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── GET /api/matches/:id/innings/:num/events ─────────────────────────────────
matches.get("/:id/innings/:num/events", async (req, res) => {
  try {
    const rows = await query(
      `SELECT be.*, p.name AS batsman_name, bw.name AS bowler_name
       FROM ball_events be
       LEFT JOIN players p  ON p.id  = be.batsman_id
       LEFT JOIN players bw ON bw.id = be.bowler_id
       WHERE be.match_id=$1 AND be.innings_num=$2
       ORDER BY be.over_num, be.ball_num, be.id`,
      [req.params.id, req.params.num]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── GET /api/matches/:id/fall-of-wickets/:num ───────────────────────────────
matches.get("/:id/fall-of-wickets/:num", async (req, res) => {
  try {
    const rows = await query(
      `SELECT be.over_num, be.ball_num, be.dismissal_type,
              p.name AS batsman_name, bw.name AS bowler_name,
              m_snap.runs AS runs_at_fall
       FROM ball_events be
       LEFT JOIN players p  ON p.id  = be.batsman_id
       LEFT JOIN players bw ON bw.id = be.bowler_id
       CROSS JOIN LATERAL (
         SELECT SUM(runs_bat + runs_extra) AS runs
         FROM ball_events b2
         WHERE b2.match_id = be.match_id
           AND b2.innings_num = be.innings_num
           AND (b2.over_num < be.over_num OR (b2.over_num = be.over_num AND b2.ball_num <= be.ball_num))
       ) m_snap
       WHERE be.match_id=$1 AND be.innings_num=$2 AND be.is_wicket=TRUE
       ORDER BY be.over_num, be.ball_num`,
      [req.params.id, req.params.num]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/matches/:id/analysis ──────────────────────────────────────────
matches.post("/:id/analysis", async (req, res) => {
  try {
    const m = await getMatch(req.params.id);
    if (!m) return res.status(404).json({ error: "not found" });

    const inn1BatName = m.inn1_batting_team_id === m.team_a_id ? m.team_a_name : m.team_b_name;
    const inn2BatName = m.inn2_batting_team_id === m.team_a_id ? m.team_a_name : m.team_b_name;

    const prompt = `
T20 Cricket Match: ${m.team_a_name} vs ${m.team_b_name} at ${m.venue}.
Status: ${m.status}.
Innings 1: ${inn1BatName} scored ${m.inn1_runs}/${m.inn1_wickets} in ${m.inn1_overs} overs (Extras: ${m.inn1_extras}).
Innings 2: ${inn2BatName} scored ${m.inn2_runs}/${m.inn2_wickets} in ${m.inn2_overs} overs (Extras: ${m.inn2_extras}).
${m.win_type ? `Result: ${m.win_type === "wickets" ? `${inn2BatName} won by ${m.win_margin} wickets` : m.win_type === "runs" ? `${inn1BatName} won by ${m.win_margin} runs` : "Match tied"}` : ""}
Provide sharp, professional analysis under 200 words:
1) Match Summary  2) Key Turning Points  3) Standout Performances  4) Verdict`;

    const analysis = await chatCompletion(
      "You are an expert cricket commentator. Write concise, insightful, professional analysis.",
      prompt
    );
    res.json({ analysis });
  } catch (e: any) { res.status(500).json({ error: e.message || "AI failed" }); }
});