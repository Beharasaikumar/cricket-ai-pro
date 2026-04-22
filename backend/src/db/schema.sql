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


--  PLAYERS TABLE
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL,
  name TEXT NOT NULL,

  CONSTRAINT fk_team
    FOREIGN KEY (team_id)
    REFERENCES teams(id)
    ON DELETE CASCADE
);

--  PLAYER STATS TABLE
CREATE TABLE IF NOT EXISTS player_stats (
  id SERIAL PRIMARY KEY,
  match_id INT NOT NULL,
  player_id INT NOT NULL,
  runs INT DEFAULT 0,
  balls INT DEFAULT 0,
  wickets INT DEFAULT 0,

  CONSTRAINT fk_match
    FOREIGN KEY (match_id)
    REFERENCES matches(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_player
    FOREIGN KEY (player_id)
    REFERENCES players(id)
    ON DELETE CASCADE,

  CONSTRAINT unique_player_match
    UNIQUE (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','scorer','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);