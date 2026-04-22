import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { broadcastScore } from "../ws.js";
import { chatCompletion } from "../services/groq.js";
import { requireAuth, requireRole } from "../middleware/auth_middleware.js";

export const matches = Router();

const SEL = `
  SELECT m.*, ta.name AS team_a_name, tb.name AS team_b_name,
         ROUND(m.team_a_balls / 6.0, 1)::float AS team_a_overs,
         ROUND(m.team_b_balls / 6.0, 1)::float AS team_b_overs
  FROM matches m
  JOIN teams ta ON ta.id = m.team_a_id
  JOIN teams tb ON tb.id = m.team_b_id
`;

matches.get("/", async (_req, res) => {
  try {
    res.json(await query(`${SEL} ORDER BY m.scheduled_at`));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

matches.get("/:id", async (req, res) => {
  try {
    const rows = await query(`${SEL} WHERE m.id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

matches.post("/:id/start", requireAuth, requireRole("admin", "scorer"), async (req, res) => {
  try {
    await query("UPDATE matches SET status='live' WHERE id=$1", [req.params.id]);
    const rows = await query(`${SEL} WHERE m.id=$1`, [req.params.id]);
    broadcastScore(Number(req.params.id), rows[0]);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

const scoreSchema = z.object({
  team: z.enum(["a", "b"]),
  runs: z.number().int().min(0).max(6),
  wicket: z.boolean().optional().default(false),
  balls: z.number().int().min(0).default(1),
  batsman_id: z.number().int().optional(),
  bowler_id: z.number().int().optional(),
});

matches.post("/:id/score", requireAuth, requireRole("admin", "scorer"), async (req, res) => {
  const parsed = scoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { team, runs, wicket, balls, batsman_id, bowler_id } = parsed.data;

  try {
    const rc = `team_${team}_runs`, wc = `team_${team}_wickets`, bc = `team_${team}_balls`;
    await query(
      `UPDATE matches SET ${rc}=${rc}+$1, ${wc}=${wc}+$2, ${bc}=${bc}+$3 WHERE id=$4`,
      [runs, wicket ? 1 : 0, balls, req.params.id]
    );
    await query(
      "INSERT INTO ball_events (match_id, team_side, runs, wicket) VALUES ($1,$2,$3,$4)",
      [req.params.id, team, runs, wicket]
    );

    // Credit batsman
    if (batsman_id) {
      await query(
        `INSERT INTO player_stats (match_id, player_id, runs, balls, wickets)
         VALUES ($1,$2,$3,$4,0)
         ON CONFLICT (match_id, player_id)
         DO UPDATE SET runs=player_stats.runs+$3, balls=player_stats.balls+$4`,
        [req.params.id, batsman_id, runs, balls]
      );
    }
    // Credit bowler: always track balls, wicket if applicable
    if (bowler_id) {
      await query(
        `INSERT INTO player_stats (match_id, player_id, runs, balls, wickets)
         VALUES ($1,$2,0,$3,$4)
         ON CONFLICT (match_id, player_id)
         DO UPDATE SET balls=player_stats.balls+$3, wickets=player_stats.wickets+$4`,
        [req.params.id, bowler_id, balls, wicket ? 1 : 0]
      );
    }

    const rows = await query(`${SEL} WHERE m.id=$1`, [req.params.id]);
    broadcastScore(Number(req.params.id), rows[0]);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

matches.post("/:id/complete", requireAuth, requireRole("admin", "scorer"), async (req, res) => {
  try {
    const rows = await query(`${SEL} WHERE m.id=$1`, [req.params.id]);
    const m = rows[0];
    if (!m) return res.status(404).json({ error: "not found" });
    const winnerId = m.team_a_runs > m.team_b_runs ? m.team_a_id
      : m.team_b_runs > m.team_a_runs ? m.team_b_id : null;
    await query("UPDATE matches SET status='completed', winner_id=$1 WHERE id=$2", [winnerId, req.params.id]);
    const updated = await query(`${SEL} WHERE m.id=$1`, [req.params.id]);
    broadcastScore(Number(req.params.id), updated[0]);
    res.json(updated[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

matches.post("/:id/analysis", async (req, res) => {
  try {
    const rows = await query(`${SEL} WHERE m.id=$1`, [req.params.id]);
    const m = rows[0];
    if (!m) return res.status(404).json({ error: "not found" });
    const prompt = `Match: ${m.team_a_name} vs ${m.team_b_name} at ${m.venue}.
Status: ${m.status}.
${m.team_a_name}: ${m.team_a_runs}/${m.team_a_wickets} in ${m.team_a_overs} overs.
${m.team_b_name}: ${m.team_b_runs}/${m.team_b_wickets} in ${m.team_b_overs} overs.
Provide: 1) Match summary, 2) Key turning points, 3) Standout performances, 4) Verdict. Under 200 words.`;
    const analysis = await chatCompletion(
      "You are an expert cricket analyst. Be sharp, insightful and professional.",
      prompt
    );
    res.json({ analysis });
  } catch (e: any) { res.status(500).json({ error: e.message || "AI failed" }); }
});

matches.get("/:id/scorecard", async (req, res) => {
  try {
    res.json(await query("SELECT * FROM ball_events WHERE match_id=$1 ORDER BY id", [req.params.id]));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

matches.get("/:id/player-stats", async (req, res) => {
  try {
    const rows = await query(
      `SELECT p.id, p.name, t.id AS team_id, t.name AS team_name,
              COALESCE(ps.runs,0) AS runs,
              COALESCE(ps.balls,0) AS balls,
              COALESCE(ps.wickets,0) AS wickets
       FROM players p
       JOIN teams t ON t.id = p.team_id
       JOIN matches m ON p.team_id IN (m.team_a_id, m.team_b_id)
       LEFT JOIN player_stats ps ON ps.player_id=p.id AND ps.match_id=m.id
       WHERE m.id=$1
       ORDER BY t.id, p.id`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});