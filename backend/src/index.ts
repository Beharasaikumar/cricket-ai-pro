import express from "express";
import cors from "cors";
import http from "http";
import "dotenv/config";
import { auth } from "./routes/auth.js";
import { tournaments } from "./routes/tournaments.js";
import { matches } from "./routes/matches.js";
import { attachWs } from "./ws.js";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || "*" }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", auth);
app.use("/api/tournaments", tournaments);
app.use("/api/matches", matches);

const server = http.createServer(app);
attachWs(server);

const port = Number(process.env.PORT || 4000);
server.listen(port, () => console.log(`CricketAI backend → http://localhost:${port}`));