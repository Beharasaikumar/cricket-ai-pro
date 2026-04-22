import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { Trophy, LayoutDashboard, Radio, Sparkles, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/live", label: "Live", icon: Radio },
  { to: "/analysis", label: "Analysis", icon: Sparkles },
];

const ROLE_STYLE: Record<string, { color: string; bg: string }> = {
  admin:  { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  scorer: { color: "#34d399", bg: "rgba(52,211,153,0.12)" },
  viewer: { color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
};

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const rs = user ? (ROLE_STYLE[user.role] ?? ROLE_STYLE.viewer) : null;

  return (
    <>
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(6,9,15,0.92)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        fontFamily: "'Barlow',sans-serif",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 58, display: "flex", alignItems: "center", gap: 28 }}>
          {/* Brand */}
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: "linear-gradient(135deg,#10b981,#059669)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 14px rgba(16,185,129,0.35)",
            }}>
              <Trophy size={16} color="white" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#f0fdf4", letterSpacing: "-0.3px" }}>
              Cricket<span style={{ color: "#10b981" }}>AI</span>
            </span>
          </Link>

          {/* Nav */}
          <nav style={{ display: "flex", gap: 2, flex: 1 }}>
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
              return (
                <Link key={to} to={to} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 7,
                  fontSize: 13.5, fontWeight: active ? 700 : 500,
                  color: active ? "#10b981" : "#6b7280",
                  background: active ? "rgba(16,185,129,0.1)" : "transparent",
                  textDecoration: "none", transition: "all 0.15s",
                }}>
                  <Icon size={14} />
                  {label}
                  {to === "/live" && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 5px #ef4444", animation: "ping 1.5s infinite" }} />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div style={{ position: "relative" }}>
            {user ? (
              <>
                <button
                  onClick={() => setOpen(!open)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 10px 5px 6px", borderRadius: 9,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)", cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: "linear-gradient(135deg,#10b981,#059669)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 800, color: "white",
                  }}>
                    {user.name[0].toUpperCase()}
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#e2e8f0", lineHeight: 1.2 }}>{user.name}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: rs?.color }}>
                      {user.role}
                    </div>
                  </div>
                  <ChevronDown size={13} style={{ color: "#6b7280", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>

                {open && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
                    <div style={{
                      position: "absolute", top: "calc(100% + 6px)", right: 0,
                      background: "#0d1520", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12, minWidth: 190, zIndex: 50,
                      boxShadow: "0 16px 40px rgba(0,0,0,0.6)", overflow: "hidden",
                    }}>
                      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{user.name}</div>
                        <div style={{ fontSize: 11, marginTop: 2, padding: "1px 7px", borderRadius: 4, display: "inline-block", background: rs?.bg, color: rs?.color, fontWeight: 700, textTransform: "capitalize" }}>
                          {user.role}
                        </div>
                      </div>
                      <button
                        onClick={() => { logout(); navigate({ to: "/login" }); }}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 9,
                          padding: "11px 16px", border: "none", background: "none",
                          color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer",
                          transition: "background 0.15s", textAlign: "left",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                      >
                        <LogOut size={14} /> Sign out
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <Link to="/login" style={{
                padding: "7px 16px", borderRadius: 8,
                background: "linear-gradient(135deg,#10b981,#059669)",
                color: "white", textDecoration: "none",
                fontSize: 13, fontWeight: 700,
                boxShadow: "0 2px 8px rgba(16,185,129,0.3)",
              }}>
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "36px 24px 80px", fontFamily: "'Barlow',sans-serif" }}>
        {children}
      </main>

      <style>{`
        @keyframes ping {
          0%,100%{opacity:1;transform:scale(1)}
          50%{opacity:0.5;transform:scale(0.7)}
        }
        *{box-sizing:border-box}
        body{background:#06090f;color:#e2e8f0}
        a{color:inherit}
        select option{background:#0d1520;color:#e2e8f0}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:#06090f}
        ::-webkit-scrollbar-thumb{background:#1f2937;border-radius:3px}
      `}</style>
    </>
  );
}