import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, type Match } from "@/lib/api";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/analysis")({
  component: () => <AppShell><AnalysisPage /></AppShell>,
});

function AnalysisPage() {
  const [matches,  setMatches]  = useState<Match[]>([]);
  const [selected, setSelected] = useState("");
  const [out,      setOut]      = useState("");
  const [loading,  setLoading]  = useState(false);

  useEffect(() => { api<Match[]>("/api/matches").then(setMatches).catch(() => {}); }, []);

  const run = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const r = await api<{ analysis: string }>(`/api/matches/${selected}/analysis`, { method: "POST" });
      setOut(r.analysis);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <div style={labelStyle}>AI</div>
        <h1 style={h1Style}>Match Analysis</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>
          Generate tactical insights, key moments and predictions via Groq llama-3.1-8b-instant
        </p>
      </div>

      <div style={{ background: "rgba(13,21,32,0.9)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 22 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select
            style={{ flex: 1, minWidth: 280, padding: "10px 13px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: selected ? "#f0fdf4" : "#6b7280", fontSize: 14, outline: "none", fontFamily: "'Barlow',sans-serif", cursor: "pointer" }}
            value={selected}
            onChange={e => setSelected(e.target.value)}
          >
            <option value="">Select a match…</option>
            {matches.map(m => (
              <option key={m.id} value={String(m.id)}>
                {m.team_a_name} vs {m.team_b_name} — {m.status}
              </option>
            ))}
          </select>
          <button
            onClick={run}
            disabled={!selected || loading}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#a78bfa,#7c3aed)", color: "white", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(124,58,237,0.3)", opacity: !selected || loading ? 0.55 : 1, fontFamily: "'Barlow',sans-serif" }}>
            <Sparkles size={14} /> {loading ? "Analyzing…" : "Generate Analysis"}
          </button>
        </div>
      </div>

      {out && (
        <div style={{ background: "rgba(13,21,32,0.9)", border: "1px solid rgba(167,139,250,0.18)", borderRadius: 16, padding: "22px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 16 }}>Analysis</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.75, color: "#d1d5db", whiteSpace: "pre-wrap" }}>{out}</p>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 6 };
const h1Style: React.CSSProperties = { margin: 0, fontSize: 34, fontWeight: 900, color: "#f0fdf4", letterSpacing: "-1px", fontFamily: "'Barlow Condensed',sans-serif", textTransform: "uppercase" };