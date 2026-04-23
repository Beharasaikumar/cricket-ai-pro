CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','scorer','viewer')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournaments (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  format      TEXT NOT NULL,
  overs       INT  NOT NULL DEFAULT 20,
  teams_count INT  NOT NULL,
  start_date  DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'upcoming',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  id            SERIAL PRIMARY KEY,
  tournament_id INT  NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  short_name    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id      SERIAL PRIMARY KEY,
  team_id INT  NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  role    TEXT NOT NULL DEFAULT 'allrounder'
);

CREATE TABLE IF NOT EXISTS matches (
  id            SERIAL PRIMARY KEY,
  tournament_id INT  NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_a_id     INT  NOT NULL REFERENCES teams(id),
  team_b_id     INT  NOT NULL REFERENCES teams(id),
  scheduled_at  TIMESTAMPTZ NOT NULL,
  venue         TEXT NOT NULL,
  toss_winner_id  INT REFERENCES teams(id),
  toss_decision   TEXT,
  status          TEXT NOT NULL DEFAULT 'scheduled',
  current_innings INT  NOT NULL DEFAULT 1,
  inn1_batting_team_id INT REFERENCES teams(id),
  inn1_runs    INT NOT NULL DEFAULT 0,
  inn1_wickets INT NOT NULL DEFAULT 0,
  inn1_balls   INT NOT NULL DEFAULT 0,
  inn1_wides   INT NOT NULL DEFAULT 0,
  inn1_noballs INT NOT NULL DEFAULT 0,
  inn1_byes    INT NOT NULL DEFAULT 0,
  inn1_legbyes INT NOT NULL DEFAULT 0,
  inn2_batting_team_id INT REFERENCES teams(id),
  inn2_runs    INT NOT NULL DEFAULT 0,
  inn2_wickets INT NOT NULL DEFAULT 0,
  inn2_balls   INT NOT NULL DEFAULT 0,
  inn2_wides   INT NOT NULL DEFAULT 0,
  inn2_noballs INT NOT NULL DEFAULT 0,
  inn2_byes    INT NOT NULL DEFAULT 0,
  inn2_legbyes INT NOT NULL DEFAULT 0,
  winner_id    INT REFERENCES teams(id),
  win_margin   INT,
  win_type     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

drop table bowling_stats cascade;

select * from matches;

CREATE TABLE IF NOT EXISTS ball_events (
  id           SERIAL PRIMARY KEY,
  match_id     INT  NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  innings_num  INT  NOT NULL,
  over_num     INT  NOT NULL,
  ball_num     INT  NOT NULL,
  batsman_id   INT  REFERENCES players(id),
  bowler_id    INT  REFERENCES players(id),
  runs_bat     INT  NOT NULL DEFAULT 0,
  runs_extra   INT  NOT NULL DEFAULT 0,
  extra_type   TEXT,
  is_wicket    BOOLEAN NOT NULL DEFAULT FALSE,
  dismissal_type TEXT,
  fielder_id   INT  REFERENCES players(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS batting_stats (
  id              SERIAL PRIMARY KEY,
  match_id        INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  innings_num     INT NOT NULL,
  player_id       INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  runs            INT NOT NULL DEFAULT 0,
  balls_faced     INT NOT NULL DEFAULT 0,
  fours           INT NOT NULL DEFAULT 0,
  sixes           INT NOT NULL DEFAULT 0,
  is_out          BOOLEAN NOT NULL DEFAULT FALSE,
  dismissal_type  TEXT,
  dismissed_by    INT REFERENCES players(id),
  fielder_id      INT REFERENCES players(id),
  batting_position INT,
  CONSTRAINT uq_bat UNIQUE (match_id, innings_num, player_id)
);

CREATE TABLE IF NOT EXISTS bowling_stats (
  id             SERIAL PRIMARY KEY,
  match_id       INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  innings_num    INT NOT NULL,
  player_id      INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  balls_bowled   INT NOT NULL DEFAULT 0,
  runs_conceded  INT NOT NULL DEFAULT 0,
  wickets        INT NOT NULL DEFAULT 0,
  wides          INT NOT NULL DEFAULT 0,
  no_balls       INT NOT NULL DEFAULT 0,
  maidens        INT NOT NULL DEFAULT 0,
  CONSTRAINT uq_bowl UNIQUE (match_id, innings_num, player_id)
);