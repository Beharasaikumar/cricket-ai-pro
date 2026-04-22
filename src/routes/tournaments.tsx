import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, type Tournament } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Plus, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tournaments")({
  component: TournamentsLayout,
});

// Layout: renders list at /tournaments, child detail at /tournaments/$id
function TournamentsLayout() {
  const matchRoute = useMatchRoute();
  // If we're on a child route (e.g. /tournaments/2), render only the child via Outlet
  const isOnChild = matchRoute({ to: "/tournaments/$id", fuzzy: true });

  if (isOnChild) {
    // Just render the child route — AppShell is applied in the child component
    return <Outlet />;
  }

  // We're at /tournaments exactly — show the list
  return (
    <AppShell>
      <Tournaments />
    </AppShell>
  );
}

const FORMAT_COLOR: Record<string, string> = { T20: "#10b981", ODI: "#60a5fa", T10: "#f59e0b" };

function Tournaments() {
  const [items, setItems]   = useState<Tournament[]>([]);
  const [open, setOpen]     = useState(false);
  const [form, setForm]     = useState({ name: "", format: "T20", start_date: "" });
  const [teams, setTeams]   = useState("Royals, Strikers, Knights, Titans, Warriors, Kings, Lions, Hawks");
  const [busy, setBusy]     = useState(false);
  const { isAdmin } = useAuth();

  const load = () => api<Tournament[]>("/api/tournaments").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      const teamList = teams.split(",").map(t => t.trim()).filter(Boolean);
      await api("/api/tournaments", {
        method: "POST",
        body: JSON.stringify({ ...form, teams_count: teamList.length, teams: teamList }),
      });
      toast.success("Tournament created with round-robin schedule");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to create tournament");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={labelSt}>Tournaments</div>
          <h1 style={h1St}>All Tournaments</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>{items.length} tournament{items.length !== 1 ? "s" : ""}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setOpen(true)} style={btnPrimary}>
            <Plus size={15} /> New Tournament
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ background: "rgba(13,21,32,0.6)", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 16, padding: "80px 24px", textAlign: "center" }}>
          <Trophy size={28} style={{ color: "#1f2937", marginBottom: 10, display: "block", margin: "0 auto 10px" }} />
          <p style={{ color: "#374151", fontSize: 14, margin: 0 }}>
            {isAdmin ? "No tournaments yet. Create your first one." : "No tournaments yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
          {items.map(t => {
            const c = FORMAT_COLOR[t.format] ?? "#10b981";
            return (
              <Link key={t.id} to="/tournaments/$id" params={{ id: String(t.id) }} style={{ textDecoration: "none" }}>
                <div
                  style={{ background: "rgba(13,21,32,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "22px 24px", cursor: "pointer", transition: "all 0.2s", position: "relative", overflow: "hidden" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${c}35`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.transform = "none"; }}
                >
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${c},transparent)` }} />
                  <div style={{ display: "inline-flex", padding: "2px 10px", borderRadius: 6, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", background: `${c}18`, color: c, border: `1px solid ${c}28`, marginBottom: 12 }}>
                    {t.format}
                  </div>
                  <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 800, color: "#f0fdf4", letterSpacing: "-0.3px" }}>{t.name}</h3>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280" }}>
                    <span>{t.teams_count} teams</span>
                    <span>{new Date(t.start_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(8px)" }}
          onClick={e => e.target === e.currentTarget && setOpen(false)}
        >
          <div style={{ background: "#0d1520", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: 32, width: "100%", maxWidth: 480, boxShadow: "0 32px 80px rgba(0,0,0,0.7)", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 20, fontWeight: 900, color: "#f0fdf4", fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase" }}>
              Create Tournament
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <ModalField label="Tournament Name">
                <input style={inpStyle} placeholder="e.g. College Premier League" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </ModalField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <ModalField label="Format">
                  <select style={inpStyle} value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}>
                    <option>T20</option>
                    <option>ODI</option>
                    <option>T10</option>
                  </select>
                </ModalField>
                <ModalField label="Start Date">
                  <input style={inpStyle} type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </ModalField>
              </div>
              <ModalField label="Teams (comma separated)">
                <textarea
                  style={{ ...inpStyle, minHeight: 80, resize: "vertical" as const }}
                  value={teams}
                  onChange={e => setTeams(e.target.value)}
                />
                <p style={{ fontSize: 11, color: "#374151", margin: "4px 0 0" }}>
                  Round-robin schedule auto-generated · 11 players per team created
                </p>
              </ModalField>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
              <button onClick={() => setOpen(false)} style={btnGhost}>Cancel</button>
              <button
                onClick={create}
                disabled={busy || !form.name || !form.start_date}
                style={{ ...btnPrimary, opacity: busy || !form.name || !form.start_date ? 0.55 : 1 }}
              >
                {busy ? "Creating…" : "Create & Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.8px" }}>{label}</label>
      {children}
    </div>
  );
}

const labelSt: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 6 };
const h1St: React.CSSProperties = { margin: 0, fontSize: 34, fontWeight: 900, color: "#f0fdf4", letterSpacing: "-1px", fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase" };
const inpStyle: React.CSSProperties = { width: "100%", padding: "10px 13px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#f0fdf4", fontSize: 14, outline: "none", fontFamily: "'Barlow',sans-serif", boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#10b981,#059669)", color: "white", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(16,185,129,0.3)", fontFamily: "'Barlow',sans-serif" };
const btnGhost: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Barlow',sans-serif" };