import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, type Match } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/analysis")({
  component: () => (<AppShell><AnalysisPage /></AppShell>),
});

function AnalysisPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);

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
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">AI</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Match analysis</h1>
        <p className="mt-2 text-muted-foreground">Generate tactical insights, key moments and predictions powered by Groq llama-3.1-8b-instant.</p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="sm:w-96"><SelectValue placeholder="Select a match" /></SelectTrigger>
            <SelectContent>
              {matches.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.team_a_name} vs {m.team_b_name} — {m.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={run} disabled={!selected || loading}>
            <Sparkles className="mr-1.5 h-4 w-4" />{loading ? "Analyzing…" : "Generate analysis"}
          </Button>
        </div>
      </Card>

      {out && (
        <Card className="p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Analysis</h3>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{out}</div>
        </Card>
      )}
    </div>
  );
}
