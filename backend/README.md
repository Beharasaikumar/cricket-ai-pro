# CricketAI Backend

Express + TypeScript + PostgreSQL (PgAdmin4) + Groq `llama-3.1-8b-instant` + WebSocket live scores.

## Setup

1. **Database** — Open PgAdmin4 and create a database named `cricketai` (or any name; update `DATABASE_URL`).

2. **Install**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   ```

3. **Configure `.env`**
   ```
   PORT=4000
   DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/cricketai
   GROQ_API_KEY=gsk_xxx          # from https://console.groq.com
   CORS_ORIGIN=http://localhost:5173
   ```

4. **Initialize tables**
   ```bash
   npm run db:init
   ```

5. **Run**
   ```bash
   npm run dev
   ```
   Server: `http://localhost:4000` · WebSocket: `ws://localhost:4000/ws?matchId=<id>`

## Frontend

In the project root:
```bash
echo "VITE_API_URL=http://localhost:4000" > .env.local
npm run dev
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/tournaments` | List tournaments |
| POST | `/api/tournaments` | Create tournament + auto round-robin schedule |
| GET  | `/api/tournaments/:id` | Tournament details |
| GET  | `/api/tournaments/:id/teams` | Teams |
| GET  | `/api/tournaments/:id/matches` | Schedule |
| GET  | `/api/matches` | All matches |
| GET  | `/api/matches/:id` | Match details |
| POST | `/api/matches/:id/start` | Start match |
| POST | `/api/matches/:id/score` | Add ball: `{ team:"a"\|"b", runs, wicket, balls }` |
| POST | `/api/matches/:id/complete` | Complete match |
| POST | `/api/matches/:id/analysis` | Groq AI analysis |
