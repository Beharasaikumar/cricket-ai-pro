import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { broadcastScore } from "../ws.js";
import { chatCompletion } from "../services/groq.js";

export const matches = Router();

const SELECT = `
  SELECT m.*, ta.name AS team_a_name, tb.name AS team_b_name,
         ROUND(m.team_a_balls / 6.0, 1) AS team_a_overs,
         ROUND(m.team_b_balls / 6.0, 1) AS team_b_overs
  FROM matches m
  JOIN teams ta ON ta.id = m.team_a_id
  JOIN teams tb ON tb.id = m.team_b_id
`;

matches.get("/", async (_req, res) => {
  const rows = await query(`${SELECT} ORDER BY m.scheduled_at`);
  res.json(rows);
});

matches.get("/:id", async (req, res) => {
  const rows = await query(`${SELECT} WHERE m.id=$1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "not found" });
  res.json(rows[0]);
});

matches.post("/:id/start", async (req, res) => {
  await query("UPDATE matches SET status='live' WHERE id=$1", [req.params.id]);
  const rows = await query(`${SELECT} WHERE m.id=$1`, [req.params.id]);
  broadcastScore(Number(req.params.id), rows[0]);
  res.json(rows[0]);
});

const scoreSchema = z.object({
  team: z.enum(["a", "b"]),
  runs: z.number().int().min(0).max(6),
  wicket: z.boolean().optional(),
  balls: z.number().int().min(0).max(6).default(1),
});

matches.post("/:id/score", async (req, res) => {
  const parsed = scoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const { team, runs, wicket, balls } = parsed.data;
  const side = team;
  const runsCol = `team_${side}_runs`;
  const wktsCol = `team_${side}_wickets`;
  const ballsCol = `team_${side}_balls`;
  await query(
    `UPDATE matches SET ${runsCol} = ${runsCol} + $1,
       ${wktsCol} = ${wktsCol} + $2,
       ${ballsCol} = ${ballsCol} + $3
     WHERE id=$4`,
    [runs, wicket ? 1 : 0, balls, req.params.id],
  );
  await query(
    "INSERT INTO ball_events (match_id, team_side, runs, wicket) VALUES ($1,$2,$3,$4)",
    [req.params.id, side, runs, wicket || false],
  );
  const rows = await query(`${SELECT} WHERE m.id=$1`, [req.params.id]);
  broadcastScore(Number(req.params.id), rows[0]);
  res.json(rows[0]);
});

matches.post("/:id/complete", async (req, res) => {
  const rows = await query(`${SELECT} WHERE m.id=$1`, [req.params.id]);
  const m = rows[0];
  const winnerId = m.team_a_runs > m.team_b_runs ? m.team_a_id : m.team_b_runs > m.team_a_runs ? m.team_b_id : null;
  await query("UPDATE matches SET status='completed', winner_id=$1 WHERE id=$2", [winnerId, req.params.id]);
  const updated = await query(`${SELECT} WHERE m.id=$1`, [req.params.id]);
  broadcastScore(Number(req.params.id), updated[0]);
  res.json(updated[0]);
});

matches.post("/:id/analysis", async (req, res) => {
  const rows = await query(`${SELECT} WHERE m.id=$1`, [req.params.id]);
  const m = rows[0];
  if (!m) return res.status(404).json({ error: "not found" });
  const prompt = `Match: ${m.team_a_name} vs ${m.team_b_name} at ${m.venue}.
Status: ${m.status}.
${m.team_a_name}: ${m.team_a_runs}/${m.team_a_wickets} in ${m.team_a_overs} overs.
${m.team_b_name}: ${m.team_b_runs}/${m.team_b_wickets} in ${m.team_b_overs} overs.

Provide a concise tactical analysis with: 1) Match summary, 2) Key turning points, 3) Standout performance areas, 4) Prediction or verdict. Keep it under 200 words, professional cricket commentary tone.`;
  try {
    const analysis = await chatCompletion(
      "You are an expert cricket analyst. Provide sharp, insightful, professional analysis.",
      prompt,
    );
    res.json({ analysis });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "AI failed" });
  }
});
