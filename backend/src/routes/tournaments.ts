import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { roundRobin } from "../services/scheduler.js";
import { requireAuth, requireRole } from "../middleware/auth_middleware.js";

export const tournaments = Router();

tournaments.get("/", async (_req, res) => {
  try { res.json(await query("SELECT * FROM tournaments ORDER BY created_at DESC")); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

tournaments.get("/:id", async (req, res) => {
  try {
    const rows = await query("SELECT * FROM tournaments WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

tournaments.get("/:id/teams", async (req, res) => {
  try { res.json(await query("SELECT * FROM teams WHERE tournament_id=$1 ORDER BY id", [req.params.id])); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

tournaments.get("/:id/matches", async (req, res) => {
  try {
    res.json(await query(
      `SELECT m.*, ta.name AS team_a_name, tb.name AS team_b_name,
              ROUND(m.team_a_balls/6.0,1)::float AS team_a_overs,
              ROUND(m.team_b_balls/6.0,1)::float AS team_b_overs
       FROM matches m
       JOIN teams ta ON ta.id=m.team_a_id
       JOIN teams tb ON tb.id=m.team_b_id
       WHERE m.tournament_id=$1 ORDER BY m.scheduled_at`,
      [req.params.id]
    ));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Points table / standings
tournaments.get("/:id/standings", async (req, res) => {
  try {
    const teams = await query<{ id: number; name: string }>(
      "SELECT id, name FROM teams WHERE tournament_id=$1", [req.params.id]
    );
    const done = await query(
      `SELECT m.* FROM matches m WHERE m.tournament_id=$1 AND m.status='completed'`,
      [req.params.id]
    );

    const s: Record<number, {
      id: number; name: string; played: number; won: number; lost: number; tied: number;
      points: number; rf: number; bf: number; ra: number; ba: number; nrr: number;
    }> = {};

    for (const t of teams) {
      s[t.id] = { id: t.id, name: t.name, played: 0, won: 0, lost: 0, tied: 0, points: 0, rf: 0, bf: 0, ra: 0, ba: 0, nrr: 0 };
    }

    for (const m of done) {
      const a = s[m.team_a_id], b = s[m.team_b_id];
      if (!a || !b) continue;
      a.played++; b.played++;
      a.rf += m.team_a_runs; a.bf += m.team_a_balls;
      a.ra += m.team_b_runs; a.ba += m.team_b_balls;
      b.rf += m.team_b_runs; b.bf += m.team_b_balls;
      b.ra += m.team_a_runs; b.ba += m.team_a_balls;
      if (m.winner_id === m.team_a_id) { a.won++; a.points += 2; b.lost++; }
      else if (m.winner_id === m.team_b_id) { b.won++; b.points += 2; a.lost++; }
      else { a.tied++; b.tied++; a.points++; b.points++; }
    }

    const result = Object.values(s).map(x => {
      const rrFor = x.bf > 0 ? (x.rf / x.bf) * 6 : 0;
      const rrAgainst = x.ba > 0 ? (x.ra / x.ba) * 6 : 0;
      return { id: x.id, name: x.name, played: x.played, won: x.won, lost: x.lost, tied: x.tied, points: x.points, nrr: parseFloat((rrFor - rrAgainst).toFixed(3)) };
    }).sort((a, b) => b.points !== a.points ? b.points - a.points : b.nrr - a.nrr);

    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

const createSchema = z.object({
  name: z.string().min(1),
  format: z.enum(["T20", "ODI", "T10"]),
  teams_count: z.number().int().min(2),
  start_date: z.string().min(1),
  teams: z.array(z.string().min(1)).min(2),
});

tournaments.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { name, format, teams_count, start_date, teams } = parsed.data;

  try {
    const [t] = await query<{ id: number }>(
      "INSERT INTO tournaments (name,format,teams_count,start_date) VALUES ($1,$2,$3,$4) RETURNING id",
      [name, format, teams_count, start_date]
    );
    const tid = t.id;

    const teamIds: number[] = [];
    for (const tn of teams) {
      const short = tn.split(/\s+/).map(w => w[0]).join("").slice(0, 3).toUpperCase();
      const [r] = await query<{ id: number }>(
        "INSERT INTO teams (tournament_id,name,short_name) VALUES ($1,$2,$3) RETURNING id",
        [tid, tn, short]
      );
      teamIds.push(r.id);
    }

    // Bulk insert 11 players per team
    const vals: any[] = [];
    const ph: string[] = [];
    let idx = 1;
    for (const teamId of teamIds) {
      for (let i = 1; i <= 11; i++) {
        ph.push(`($${idx++},$${idx++})`);
        vals.push(teamId, `Player ${i}`);
      }
    }
    await query(`INSERT INTO players (team_id,name) VALUES ${ph.join(",")}`, vals);

    // Generate round-robin fixtures
    const fixtures = roundRobin(teamIds);
    const venues = ["Main Ground", "North Pavilion", "East Stadium", "Heritage Field"];
    const base = new Date(start_date);
    for (let i = 0; i < fixtures.length; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + Math.floor(i / 2));
      d.setHours(i % 2 === 0 ? 14 : 18, 0, 0, 0);
      await query(
        "INSERT INTO matches (tournament_id,team_a_id,team_b_id,scheduled_at,venue) VALUES ($1,$2,$3,$4,$5)",
        [tid, fixtures[i].a, fixtures[i].b, d.toISOString(), venues[i % venues.length]]
      );
    }

    res.json({ id: tid });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

tournaments.get("/:id/players", async (req, res) => {
  try {
    let rows = await query(
      `SELECT p.*, t.name AS team_name FROM players p
       JOIN teams t ON t.id=p.team_id WHERE t.tournament_id=$1 ORDER BY t.id, p.id`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

tournaments.put("/players/:pid", requireAuth, requireRole("admin", "scorer"), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    await query("UPDATE players SET name=$1 WHERE id=$2", [name, req.params.pid]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

tournaments.delete("/players/:pid", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await query("DELETE FROM players WHERE id=$1", [req.params.pid]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

tournaments.post("/players", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { team_id, name } = req.body;
    const [row] = await query("INSERT INTO players (team_id,name) VALUES ($1,$2) RETURNING *", [team_id, name]);
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});