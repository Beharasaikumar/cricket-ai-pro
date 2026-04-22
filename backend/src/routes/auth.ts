import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db/pool.js";

export const auth = Router();

const SECRET = process.env.JWT_SECRET || "cricketai-secret";

auth.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email and password are required" });
  }
  const validRole = ["admin", "scorer", "viewer"].includes(role) ? role : "viewer";

  try {
    const existing = await query("SELECT id FROM users WHERE email=$1", [email]);
    if (existing.length > 0) return res.status(409).json({ error: "Email already registered" });

    const hash = await bcrypt.hash(password, 10);
    const rows = await query<{ id: number; name: string; role: string }>(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, role",
      [name, email, hash, validRole]
    );
    const user = rows[0];
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Registration failed" });
  }
});

auth.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  try {
    const rows = await query<{ id: number; name: string; role: string; password_hash: string }>(
      "SELECT id, name, role, password_hash FROM users WHERE email=$1", [email]
    );
    if (!rows[0]) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const user = rows[0];
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Login failed" });
  }
});

auth.get("/me", (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });
  try {
    const payload = jwt.verify(header.slice(7), SECRET) as any;
    res.json({ id: payload.id, name: payload.name, role: payload.role });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});