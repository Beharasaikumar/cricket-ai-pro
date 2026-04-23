const API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000";

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("ca_token");
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text).error || text; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const WS_URL = (
  (import.meta.env.VITE_API_URL as string) || "http://localhost:4000"
).replace(/^http/, "ws");

export type UserRole = "admin" | "scorer" | "viewer";
export type AuthUser = { id: number; name: string; role: UserRole };

export type Tournament = {
  id: number; name: string; format: string; overs: number;
  teams_count: number; start_date: string; status: string;
};

export type Team = {
  id: number; name: string; short_name: string; tournament_id: number;
};

export type Player = {
  id: number; name: string; team_id: number; team_name: string; role: string;
};

// Full match object returned by backend
export type Match = {
  id: number;
  tournament_id: number;
  team_a_id: number;
  team_b_id: number;
  team_a_name: string;
  team_b_name: string;
  scheduled_at: string;
  venue: string;
  toss_winner_id: number | null;
  toss_decision: "bat" | "bowl" | null;
  status: "scheduled" | "live" | "completed";
  current_innings: 1 | 2;

  // Innings 1
  inn1_batting_team_id: number | null;
  inn1_runs: number;
  inn1_wickets: number;
  inn1_balls: number;
  inn1_overs: string;   // "X.Y" format e.g. "12.3"
  inn1_extras: number;
  inn1_wides: number;
  inn1_noballs: number;
  inn1_byes: number;
  inn1_legbyes: number;

  // Innings 2
  inn2_batting_team_id: number | null;
  inn2_runs: number;
  inn2_wickets: number;
  inn2_balls: number;
  inn2_overs: string;
  inn2_extras: number;
  inn2_wides: number;
  inn2_noballs: number;
  inn2_byes: number;
  inn2_legbyes: number;

  winner_id: number | null;
  win_margin: number | null;
  win_type: "runs" | "wickets" | "tie" | "no_result" | null;
};

// A single delivery
export type BallEvent = {
  id: number;
  match_id: number;
  innings_num: 1 | 2;
  over_num: number;
  ball_num: number;
  batsman_id: number | null;
  bowler_id: number | null;
  batsman_name: string | null;
  bowler_name: string | null;
  runs_bat: number;
  runs_extra: number;
  extra_type: "wide" | "noball" | "bye" | "legbye" | null;
  is_wicket: boolean;
  dismissal_type: string | null;
  fielder_id: number | null;
};

// Batting scorecard row
export type BattingRow = {
  player_id: number;
  player_name: string;
  runs: number;
  balls_faced: number;
  fours: number;
  sixes: number;
  is_out: boolean;
  dismissal_type: string | null;
  dismissed_by_name: string | null;
  fielder_name: string | null;
  batting_position: number | null;
};

// Bowling scorecard row
export type BowlingRow = {
  player_id: number;
  player_name: string;
  balls_bowled: number;
  runs_conceded: number;
  wickets: number;
  wides: number;
  no_balls: number;
  maidens: number;
};

export type Standing = {
  id: number; name: string;
  played: number; won: number; lost: number; tied: number;
  points: number; nrr: number;
};

// Helper: dismissal display string like "c Kohli b Bumrah"
export function dismissalText(row: BattingRow): string {
  if (!row.is_out) return "not out";
  switch (row.dismissal_type) {
    case "bowled":    return `b ${row.dismissed_by_name ?? ""}`;
    case "caught":    return `c ${row.fielder_name ?? ""} b ${row.dismissed_by_name ?? ""}`;
    case "lbw":       return `lbw b ${row.dismissed_by_name ?? ""}`;
    case "run_out":   return `run out (${row.fielder_name ?? ""})`;
    case "stumped":   return `st ${row.fielder_name ?? ""} b ${row.dismissed_by_name ?? ""}`;
    case "hit_wicket":return `hit wicket b ${row.dismissed_by_name ?? ""}`;
    case "retired_hurt": return "retired hurt";
    default:          return "out";
  }
}

// Helper: cricket overs string → balls
export function oversToBalls(overs: string): number {
  const [o, b] = overs.split(".").map(Number);
  return (o * 6) + (b || 0);
}

// Helper: run rate
export function runRate(runs: number, balls: number): string {
  if (balls === 0) return "0.00";
  return ((runs / balls) * 6).toFixed(2);
}

// Helper: required run rate
export function requiredRunRate(needed: number, ballsLeft: number): string {
  if (ballsLeft <= 0) return "—";
  return ((needed / ballsLeft) * 6).toFixed(2);
}