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

export const WS_URL = ((import.meta.env.VITE_API_URL as string) || "http://localhost:4000").replace(/^http/, "ws");


export type UserRole = "admin" | "scorer" | "viewer";

export type AuthUser = { id: number; name: string; role: UserRole };

export type Tournament = {
  id: number; name: string; format: string;
  teams_count: number; start_date: string; status: string;
};

export type Team = { id: number; name: string; short_name: string; tournament_id: number };

export type Match = {
  id: number; tournament_id: number;
  team_a_id: number; team_b_id: number;
  team_a_name: string; team_b_name: string;
  scheduled_at: string; venue: string;
  status: "scheduled" | "live" | "completed";
  team_a_runs: number; team_a_wickets: number; team_a_overs: number;
  team_b_runs: number; team_b_wickets: number; team_b_overs: number;
  winner_id: number | null;
};

export type BallEvent = {
  id: number; match_id: number; team_side: "a" | "b"; runs: number; wicket: boolean;
};

export type PlayerStat = {
  id: number; name: string; team_id: number; team_name: string;
  runs: number; balls: number; wickets: number;
};

export type Player = { id: number; name: string; team_id: number; team_name: string };

export type Standing = {
  id: number; name: string;
  played: number; won: number; lost: number; tied: number;
  points: number; nrr: number;
};