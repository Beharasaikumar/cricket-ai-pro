CREATE TABLE IF NOT EXISTS tournaments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  teams_count INT NOT NULL,
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  tournament_id INT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_a_id INT NOT NULL REFERENCES teams(id),
  team_b_id INT NOT NULL REFERENCES teams(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  venue TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  team_a_runs INT NOT NULL DEFAULT 0,
  team_a_wickets INT NOT NULL DEFAULT 0,
  team_a_balls INT NOT NULL DEFAULT 0,
  team_b_runs INT NOT NULL DEFAULT 0,
  team_b_wickets INT NOT NULL DEFAULT 0,
  team_b_balls INT NOT NULL DEFAULT 0,
  winner_id INT REFERENCES teams(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ball_events (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_side CHAR(1) NOT NULL,
  runs INT NOT NULL DEFAULT 0,
  wicket BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
