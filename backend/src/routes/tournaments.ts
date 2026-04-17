import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { roundRobin } from "../services/scheduler.js";

export const tournaments = Router();

tournaments.get("/", async (_req, res) => {
  const rows = await query("SELECT * FROM tournaments ORDER BY created_at DESC");
  res.json(rows);
});

tournaments.get("/:id", async (req, res) => {
  const rows = await query("SELECT * FROM tournaments WHERE id=$1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "not found" });
  res.json(rows[0]);
});

tournaments.get("/:id/teams", async (req, res) => {
  const rows = await query("SELECT * FROM teams WHERE tournament_id=$1 ORDER BY id", [req.params.id]);
  res.json(rows);
});

tournaments.get("/:id/matches", async (req, res) => {
  const rows = await query(
    `SELECT m.*, ta.name AS team_a_name, tb.name AS team_b_name,
            ROUND(m.team_a_balls / 6.0, 1) AS team_a_overs,
            ROUND(m.team_b_balls / 6.0, 1) AS team_b_overs
     FROM matches m
     JOIN teams ta ON ta.id = m.team_a_id
     JOIN teams tb ON tb.id = m.team_b_id
     WHERE m.tournament_id=$1
     ORDER BY m.scheduled_at`,
    [req.params.id],
  );
  res.json(rows);
});

const createSchema = z.object({
  name: z.string().min(1),
  format: z.string().min(1),
  teams_count: z.number().int().min(2),
  start_date: z.string().min(1),
  teams: z.array(z.string().min(1)).min(2),
});

tournaments.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error);
  const { name, format, teams_count, start_date, teams } = parsed.data;

  const t = await query<{ id: number }>(
    "INSERT INTO tournaments (name, format, teams_count, start_date) VALUES ($1,$2,$3,$4) RETURNING id",
    [name, format, teams_count, start_date],
  );
  const tournamentId = t[0].id;

  const teamIds: number[] = [];
  for (const tn of teams) {
    const short = tn.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
    const r = await query<{ id: number }>(
      "INSERT INTO teams (tournament_id, name, short_name) VALUES ($1,$2,$3) RETURNING id",
      [tournamentId, tn, short],
    );
    teamIds.push(r[0].id);
  }

  const fixtures = roundRobin(teamIds);
  const venues = ["Main Ground", "North Pavilion", "East Stadium", "Heritage Field"];
  const baseDate = new Date(start_date);
  for (let i = 0; i < fixtures.length; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + Math.floor(i / 2));
    d.setHours(i % 2 === 0 ? 14 : 18, 0, 0, 0);
    await query(
      "INSERT INTO matches (tournament_id, team_a_id, team_b_id, scheduled_at, venue) VALUES ($1,$2,$3,$4,$5)",
      [tournamentId, fixtures[i].a, fixtures[i].b, d.toISOString(), venues[i % venues.length]],
    );
  }

  res.json({ id: tournamentId });
});
