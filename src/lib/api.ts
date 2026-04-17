const API_URL = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const WS_URL = ((import.meta.env.VITE_API_URL as string) || "http://localhost:4000").replace(/^http/, "ws");

export type Tournament = {
  id: number;
  name: string;
  format: string;
  teams_count: number;
  start_date: string;
  status: string;
};

export type Team = { id: number; name: string; short_name: string; tournament_id: number };

export type Match = {
  id: number;
  tournament_id: number;
  team_a_id: number;
  team_b_id: number;
  team_a_name?: string;
  team_b_name?: string;
  scheduled_at: string;
  venue: string;
  status: "scheduled" | "live" | "completed";
  team_a_runs: number;
  team_a_wickets: number;
  team_a_overs: number;
  team_b_runs: number;
  team_b_wickets: number;
  team_b_overs: number;
  winner_id: number | null;
};
