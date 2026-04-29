# CricketAI — Tournament Command Center

A full-stack AI-powered cricket tournament analytics platform with real-time ball-by-ball match tracking, live scoring, and Groq-powered AI insights. Built for tournament organizers and scorers to manage matches, track statistics, and get intelligent analysis.

## 🎯 Key Features

✅ **Tournament Management** - Create tournaments with teams, manage formats, and track status  
✅ **Real-time Match Scoring** - Ball-by-ball tracking with WebSocket live updates  
✅ **Cricket Statistics** - Track runs, wickets, extras, overs in proper cricket format  
✅ **AI-Powered Analysis** - Groq LLM integration for match insights and predictions  
✅ **Role-Based Access** - Admin, Scorer, and Viewer roles with appropriate permissions  
✅ **Live Scorecard** - Real-time score updates visible to all connected clients  
✅ **Player & Team Management** - Add players to teams with roles (batter, bowler, allrounder)  
✅ **Match History** - Complete match records with winner, margins, and statistics  

## 🛠 Tech Stack

### Frontend
- **React 19** with TypeScript - UI framework
- **TanStack Router** - Type-safe routing
- **TanStack Query** - Server state management
- **Tailwind CSS 4** - Utility-first styling
- **Shadcn/ui** - Accessible component library (50+ components)
- **Recharts** - Data visualization for statistics
- **React Hook Form** + **Zod** - Form handling & validation
- **Vite** - Next-gen build tool
- **Bun** - Fast package manager

### Backend
- **Express.js** - Lightweight HTTP server
- **Node.js** - Runtime environment
- **PostgreSQL** - Relational database
- **WebSocket** - Real-time bidirectional communication
- **JWT** - Secure token-based authentication
- **bcryptjs** - Password hashing
- **Groq SDK** - AI completions (llama-3.1-8b-instant model)
- **TypeScript** - Type safety
- **Zod** - Runtime validation

## 📋 Prerequisites

- **Node.js** v18+ or **Bun** (v1.0+)
- **PostgreSQL** v12+ (running locally or remote)
- **Git** for version control
- **Groq API Key** (free tier available at [Groq](https://console.groq.com))

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd cricket-ai-pro
```

### 2. Install Dependencies

```bash
# Using Bun (recommended)
bun install

# Or using npm
npm install
```

### 3. Environment Configuration

Create a `.env` file in the project root with these variables:

```env
# Backend Server
PORT=4000
NODE_ENV=development

# Database (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cricket_ai

# JWT Secret (generate a strong random string)
JWT_SECRET=your_super_secret_jwt_key_here_change_this

# Groq AI API (get from https://console.groq.com)
GROQ_API_KEY=gsk_your_groq_api_key_here

# Frontend API URL
VITE_API_URL=http://localhost:4000

# CORS Origin
CORS_ORIGIN=http://localhost:5173,http://localhost:4000
```

### 4. Database Setup

Initialize the PostgreSQL database:

```bash
cd backend
bun run db:init
# This creates all required tables (users, tournaments, teams, matches, players, etc.)
```

### 5. Start Development Servers

**Terminal 1 - Frontend:**
```bash
bun run dev
# Frontend runs on http://localhost:5173
```

**Terminal 2 - Backend:**
```bash
cd backend
bun run dev
# Backend runs on http://localhost:4000
# WebSocket available at ws://localhost:4000
```

Open [http://localhost:5173](http://localhost:5173) in your browser to access the application.

## 📁 Project Structure

```
cricket-ai-pro/
├── src/                              # Frontend React application
│   ├── routes/                       # TanStack Router pages (file-based routing)
│   │   ├── __root.tsx               # Root layout with auth provider
│   │   ├── index.tsx                # Home/dashboard page
│   │   ├── login.tsx                # User login page
│   │   ├── signup.tsx               # User registration page
│   │   ├── tournaments.tsx          # Tournaments list page
│   │   ├── tournaments.$id.tsx      # Tournament details page
│   │   ├── analysis.tsx             # Cricket analytics page
│   │   └── live/                    # Live match pages
│   │       ├── index.tsx            # Live matches list
│   │       └── $matchId.tsx         # Live match scorecard
│   ├── components/                   # React components
│   │   ├── ui/                      # Shadcn/ui components (50+ pre-built)
│   │   │   ├── button.tsx, card.tsx, dialog.tsx, form.tsx, etc.
│   │   │   └── chart.tsx            # Recharts integration
│   │   ├── AppShell.tsx             # Main app layout wrapper
│   │   └── ProtectedRoute.tsx       # Route protection component
│   ├── hooks/                        # Custom React hooks
│   │   └── use-mobile.tsx           # Mobile detection hook
│   ├── lib/                          # Utilities & services
│   │   ├── api.ts                   # API client for backend calls
│   │   ├── auth.tsx                 # Auth context & provider
│   │   └── utils.ts                 # Helper functions
│   ├── router.tsx                    # Router configuration
│   ├── styles.css                    # Global Tailwind styles
│   └── routeTree.gen.ts             # Auto-generated route tree
│
├── backend/                          # Express Node.js backend
│   ├── src/
│   │   ├── index.ts                 # Server entry point (Express app)
│   │   ├── ws.ts                    # WebSocket connection handling
│   │   ├── db/
│   │   │   ├── init.ts              # Database table initialization
│   │   │   ├── pool.ts              # PostgreSQL connection pool
│   │   │   └── schema.sql           # SQL table definitions
│   │   ├── middleware/
│   │   │   └── auth_middleware.ts   # JWT verification middleware
│   │   ├── routes/
│   │   │   ├── auth.ts              # Auth endpoints (register/login/me)
│   │   │   ├── matches.ts           # Match endpoints (CRUD + live scoring)
│   │   │   └── tournaments.ts       # Tournament endpoints (CRUD)
│   │   └── services/
│   │       ├── groq.ts              # Groq AI LLM integration
│   │       └── scheduler.ts         # Background job scheduling
│   ├── package.json
│   ├── tsconfig.json
│   └── wrangler.jsonc               # Cloudflare Workers config
│
├── components.json                   # Shadcn/ui CLI configuration
├── package.json                      # Root dependencies
├── bun.lockb                         # Bun lock file
├── vite.config.ts                    # Vite build configuration
├── tsconfig.json                     # TypeScript configuration
└── eslint.config.js                  # ESLint rules
```

## 🔌 API Endpoints

All API requests should include `Authorization: Bearer <token>` header for protected routes.

### Authentication (`/api/auth`)
- `POST /api/auth/register` - User registration (returns JWT token)
  - Body: `{ name, email, password, role?: "admin"|"scorer"|"viewer" }`
- `POST /api/auth/login` - User login (returns JWT token)
  - Body: `{ email, password }`
- `GET /api/auth/me` - Get current user info (requires token)

### Tournaments (`/api/tournaments`)
- `GET /api/tournaments` - List all tournaments
- `POST /api/tournaments` - Create new tournament (admin only)
  - Body: `{ name, format, overs, teams_count, start_date }`
- `GET /api/tournaments/:id` - Get tournament details with matches & teams
- `PUT /api/tournaments/:id` - Update tournament (admin only)
- `DELETE /api/tournaments/:id` - Delete tournament (admin only)

### Matches (`/api/matches`)
- `GET /api/matches` - List all matches
- `GET /api/matches/:id` - Get match details with full scorecard
- `POST /api/matches` - Create new match (admin only)
  - Body: `{ tournament_id, team_a_id, team_b_id, scheduled_at, venue }`
- `PUT /api/matches/:id` - Update match (scorer role)
  - Update: toss info, current innings, runs, wickets, extras, etc.
- `POST /api/matches/:id/ball` - Record ball event (scorer only)
  - Body: `{ innings_num, over_num, ball_num, batsman_id, bowler_id, runs_bat, is_wicket, ... }`
- `POST /api/matches/:id/end-innings` - End current innings (scorer only)
- `POST /api/matches/:id/finish` - Mark match as completed (scorer only)
- `POST /api/matches/:id/analysis` - Get AI analysis of match (Groq powered)

### WebSocket (`/ws`)
- Connect: `ws://localhost:4000`
- Messages: Real-time match score updates
  - On ball event: `{ type: "score_update", match_id, data: {...} }`
  - On match end: `{ type: "match_finished", match_id, winner_id, ... }`

## 🔐 Authentication & Roles

The application uses **JWT (JSON Web Tokens)** with 3 role-based access levels:

### User Roles
- **Admin** - Full access: create tournaments, manage matches, view all data
- **Scorer** - Live scoring: update match stats, record ball-by-ball events
- **Viewer** - Read-only: view tournaments and live scores

### Authentication Flow
1. User registers via `/api/auth/register` with email & password
2. Password is hashed using bcryptjs (10 salt rounds)
3. JWT token issued with 7-day expiration
4. Token stored in localStorage on frontend
5. Sent in request headers: `Authorization: Bearer <token>`
6. Token verified by middleware before protected routes execute

## 🤖 AI-Powered Match Analysis

Uses **Groq's llama-3.1-8b-instant** LLM model for fast AI inference:

- **Match Insights** - AI analyzes completed matches and generates insights
- **Performance Metrics** - LLM evaluates player and team performance
- **Match Predictions** - AI provides analysis based on live match progression
- **Statistical Analysis** - Trends and patterns identified from match data

**Setup:**
1. Get free API key from [Groq Console](https://console.groq.com)
2. Add `GROQ_API_KEY` to `.env` file
3. Call `POST /api/matches/:id/analysis` to generate AI insights

## 📦 Building & Deployment

### Production Build

**Frontend:**
```bash
bun run build
# Creates optimized build in dist/ directory
bun run preview  # Preview production build locally
```

**Backend:**
```bash
cd backend
bun run build  # Compiles TypeScript to dist/ directory
bun run start  # Run compiled JavaScript
```

### Docker Deployment

Create `Dockerfile` for containerized deployment:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t cricket-ai .
docker run -p 4000:4000 --env-file .env cricket-ai
```

### Cloudflare Workers Deployment

Deploy backend to Cloudflare Workers:
```bash
cd backend
wrangler deploy
```

Configure in `wrangler.jsonc`:
```jsonc
{
  "name": "cricket-ai-backend",
  "main": "src/index.ts",
  "env": {
    "production": {
      "routes": [{ "pattern": "api.cricketai.com/*" }]
    }
  }
}
```

## 🧪 Development Scripts

### Frontend Commands
```bash
bun run dev          # Start Vite dev server (http://localhost:5173)
bun run build        # Build for production
bun run build:dev    # Build in development mode
bun run preview      # Preview production build
bun run lint         # Run ESLint checks
bun run format       # Format code with Prettier
```

### Backend Commands
```bash
cd backend

bun run dev          # Start Express server with auto-reload (http://localhost:4000)
bun run build        # Compile TypeScript → dist/
bun run start        # Run compiled server
bun run db:init      # Initialize PostgreSQL database
```

### Code Quality
```bash
bun run lint         # Check for linting issues
bun run format       # Auto-format all code
```

## 🗄️ Database Schema

PostgreSQL database with the following tables:

### `users`
- `id` (PK), `name`, `email` (unique), `password_hash`, `role` (admin/scorer/viewer), `created_at`

### `tournaments`
- `id` (PK), `name`, `format` (T20/ODI/Test), `overs`, `teams_count`, `start_date`, `status` (upcoming/live/completed), `created_at`

### `teams`
- `id` (PK), `tournament_id` (FK), `name`, `short_name`

### `players`
- `id` (PK), `team_id` (FK), `name`, `role` (batter/bowler/allrounder)

### `matches`
- `id` (PK), `tournament_id` (FK), `team_a_id` (FK), `team_b_id` (FK)
- Toss info: `toss_winner_id`, `toss_decision`
- Status: `status`, `current_innings`, `scheduled_at`, `venue`
- **Innings 1 stats**: `inn1_batting_team_id`, `inn1_runs`, `inn1_wickets`, `inn1_balls`, `inn1_wides`, `inn1_noballs`, `inn1_byes`, `inn1_legbyes`
- **Innings 2 stats**: `inn2_*` (same as innings 1)
- Match result: `winner_id`, `win_margin`, `win_type` (wickets/runs/no-result), `created_at`

### `ball_events`
- `id` (PK), `match_id` (FK), `innings_num`, `over_num`, `ball_num`
- Players: `batsman_id` (FK), `bowler_id` (FK)
- Runs: `runs_bat`, `runs_extras` (wides, no-balls, byes, leg-byes)
- `is_wicket`, `wicket_type`, `is_boundary` (4/6)

**Initialize with:**
```bash
cd backend && bun run db:init
```

## 📝 Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PORT` | Yes | Backend server port | `4000` |
| `NODE_ENV` | Yes | Environment mode | `development` or `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/cricket_ai` |
| `JWT_SECRET` | Yes | Secret key for JWT signing | `super_secret_random_key` |
| `GROQ_API_KEY` | Yes | Groq API key for AI | `gsk_xxxxx` |
| `VITE_API_URL` | Yes | Backend API URL for frontend | `http://localhost:4000` |
| `CORS_ORIGIN` | No | Allowed origins for CORS | `http://localhost:5173,http://localhost:4000` |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 Code Quality

- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier for consistent code style
- **Type Safety**: Full TypeScript with strict mode

Run linter:
```bash
bun run lint
```

Format code:
```bash
bun run format
```

## 🐛 Troubleshooting

### PostgreSQL Connection Issues
**Error:** `connect ECONNREFUSED 127.0.0.1:5432`
- Ensure PostgreSQL is running: `psql --version`
- Verify `DATABASE_URL` in `.env` is correct
- Check PostgreSQL service: `sudo systemctl start postgresql` (Linux) or use Windows Services
- Create database if missing: `createdb cricket_ai`

### WebSocket Connection Issues
**Error:** `WebSocket connection failed`
- Verify backend is running on correct port (4000)
- Check firewall isn't blocking WebSocket connections
- Ensure `VITE_API_URL` matches backend URL in frontend
- Check browser console for CORS errors

### JWT Authentication Errors
**Error:** `Invalid token` or `Token expired`
- Clear localStorage and re-login
- Verify `JWT_SECRET` is the same on backend
- Check token hasn't expired (7 days default)
- Token should be sent as: `Authorization: Bearer <token>`

### Groq API Issues
**Error:** `GROQ_API_KEY not found` or rate limit errors
- Verify `GROQ_API_KEY` in `.env` is valid
- Check you have Groq credits/quota available
- Review [Groq rate limits](https://console.groq.com/docs/rate-limits)
- Increase `max_tokens` if responses are truncated

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules bun.lockb
bun install

# Clear TypeScript cache
cd backend && tsc --listFiles
```

### Port Already in Use
```bash
# Find process using port 4000
lsof -i :4000  # Linux/Mac
netstat -ano | findstr :4000  # Windows

# Kill the process
kill -9 <PID>  # Linux/Mac
taskkill /PID <PID> /F  # Windows
```

## 🏏 Cricket-Specific Features

### Ball-by-Ball Tracking
- Track every ball delivered in a match
- Record runs, boundaries, and extras (wides, no-balls, byes, leg-byes)
- Manage wickets with wicket types and dismissals
- Automatic overs calculation (cricket format: X.Y where X=overs, Y=balls)

### Match Formats
Supports multiple cricket formats:
- **T20** - 20 overs per innings
- **ODI** - 50 overs per innings  
- **Test** - Unlimited overs (can be configured)
- **Custom** - Any number of overs

### Innings Management
- Two innings per match (Team A, then Team B)
- Automatic wicket and run tracking per innings
- Extras tracking: wides, no-balls, byes, leg-byes
- Current innings status and ball count in cricket format

### Player Statistics
- Batter statistics: runs, balls faced, strike rate
- Bowler statistics: runs conceded, wickets, economy rate
- Team aggregates and performance metrics
- Historical match statistics

### 1. Create a Tournament & Start Scoring

```bash
# Register as admin
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@cricket.ai",
    "password": "securepass123",
    "role": "admin"
  }'

# Create tournament (use token from registration)
curl -X POST http://localhost:4000/api/tournaments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cricket World Cup 2026",
    "format": "T20",
    "overs": 20,
    "teams_count": 4,
    "start_date": "2026-05-01"
  }'

# Create match in tournament
curl -X POST http://localhost:4000/api/matches \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tournament_id": 1,
    "team_a_id": 1,
    "team_b_id": 2,
    "scheduled_at": "2026-05-15T18:00:00Z",
    "venue": "Stadium Ground"
  }'
```

### 2. Real-Time Live Scoring

```javascript
// Connect WebSocket in frontend
const ws = new WebSocket('ws://localhost:4000');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'score_update') {
    // Update UI with live score
    console.log('Live update:', message.data);
  }
};

// Send ball event via API
fetch('http://localhost:4000/api/matches/1/ball', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    innings_num: 1,
    over_num: 5,
    ball_num: 3,
    batsman_id: 10,
    bowler_id: 15,
    runs_bat: 4,
    is_wicket: false
  })
});
```

### 3. Get AI Match Analysis

```bash
curl -X POST http://localhost:4000/api/matches/1/analysis \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "analysis_type": "match_summary"
  }'

# Response includes AI-generated insights about the match
```

## �📞 Support

For issues and questions:
1. Check existing GitHub issues
2. Create a new issue with detailed information
3. Include error messages and reproduction steps

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Shadcn/ui](https://ui.shadcn.com/) - Component library
- [TanStack](https://tanstack.com/) - React Router and Query
- [Groq](https://groq.com/) - AI integration
- [Radix UI](https://www.radix-ui.com/) - Accessible components

---

**Happy coding! 🏏⚡**
