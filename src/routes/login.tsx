import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api, type AuthUser } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Trophy, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: AuthPage,
});

type Mode = "login" | "register";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [role, setRole] = useState<"admin" | "scorer" | "viewer">("viewer");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      const body = mode === "login"
        ? { email, password: pass }
        : { name, email, password: pass, role };
      const res = await api<{ token: string; user: AuthUser }>(
        `/api/auth/${mode === "login" ? "login" : "register"}`,
        { method: "POST", body: JSON.stringify(body) }
      );
      login(res.token, res.user);
      navigate({ to: "/" });
    } catch (e: any) {
      setErr(e.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const roles: { value: "admin" | "scorer" | "viewer"; label: string; desc: string; color: string }[] = [
    { value: "admin",  label: "Admin",  desc: "Full access",    color: "#fbbf24" },
    { value: "scorer", label: "Scorer", desc: "Score matches",  color: "#34d399" },
    { value: "viewer", label: "Viewer", desc: "View only",      color: "#60a5fa" },
  ];

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#06090f", fontFamily: "'Barlow',sans-serif", position: "relative", overflow: "hidden",
    }}>
      {/* Background grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(16,185,129,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,0.03) 1px,transparent 1px)",
        backgroundSize: "48px 48px",
      }} />
      <div style={{
        position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)",
        width: 700, height: 700, pointerEvents: "none",
        background: "radial-gradient(circle,rgba(16,185,129,0.08) 0%,transparent 65%)",
      }} />

      <div style={{ width: "100%", maxWidth: 420, padding: "0 20px", position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 32 }}>
          <div style={{
            width: 50, height: 50, borderRadius: 14,
            background: "linear-gradient(135deg,#10b981,#059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 28px rgba(16,185,129,0.4)",
          }}>
            <Trophy size={24} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#f0fdf4", letterSpacing: "-0.5px" }}>
              Cricket<span style={{ color: "#10b981" }}>AI</span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: "1.5px" }}>
              Tournament Platform
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(13,21,32,0.95)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20, padding: "28px 28px 32px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.06)",
          backdropFilter: "blur(20px)",
        }}>
          {/* Tabs */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 3, marginBottom: 24 }}>
            {(["login", "register"] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{
                flex: 1, padding: "8px", borderRadius: 8, border: "none",
                fontSize: 13.5, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                background: mode === m ? "#10b981" : "transparent",
                color: mode === m ? "white" : "#6b7280",
                boxShadow: mode === m ? "0 2px 8px rgba(16,185,129,0.35)" : "none",
                fontFamily: "'Barlow',sans-serif",
              }}>
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mode === "register" && (
              <Field label="Full Name">
                <input style={inputStyle} placeholder="e.g. Sachin Tendulkar" value={name} onChange={e => setName(e.target.value)} />
              </Field>
            )}

            <Field label="Email">
              <input style={inputStyle} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </Field>

            <Field label="Password">
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...inputStyle, paddingRight: 40 }}
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()}
                />
                <button onClick={() => setShowPass(!showPass)} style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 0,
                }}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            {mode === "register" && (
              <Field label="Role">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {roles.map(r => (
                    <button key={r.value} onClick={() => setRole(r.value)} style={{
                      padding: "10px 6px", borderRadius: 10,
                      border: `1px solid ${role === r.value ? r.color : "rgba(255,255,255,0.08)"}`,
                      background: role === r.value ? `${r.color}18` : "rgba(255,255,255,0.03)",
                      cursor: "pointer", transition: "all 0.15s",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                      fontFamily: "'Barlow',sans-serif",
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: role === r.value ? r.color : "#9ca3af" }}>{r.label}</span>
                      <span style={{ fontSize: 10, color: "#4b5563" }}>{r.desc}</span>
                    </button>
                  ))}
                </div>
              </Field>
            )}

            {err && (
              <div style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#f87171",
              }}>
                {err}
              </div>
            )}

            <button
              onClick={submit}
              disabled={busy || !email || !pass || (mode === "register" && !name)}
              style={{
                padding: "12px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg,#10b981,#059669)",
                color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer",
                boxShadow: "0 4px 14px rgba(16,185,129,0.3)", marginTop: 4,
                opacity: (busy || !email || !pass || (mode === "register" && !name)) ? 0.55 : 1,
                transition: "all 0.2s", fontFamily: "'Barlow',sans-serif",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#6b7280" }}>
          {mode === "login" ? "No account?" : "Already registered?"}{" "}
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }} style={{
            background: "none", border: "none", color: "#10b981", cursor: "pointer",
            fontSize: 13, fontWeight: 700, fontFamily: "'Barlow',sans-serif",
          }}>
            {mode === "login" ? "Register here" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px", borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.05)", color: "#f0fdf4",
  fontSize: 14, outline: "none", fontFamily: "'Barlow',sans-serif",
  boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.8px" }}>{label}</label>
      {children}
    </div>
  );
}