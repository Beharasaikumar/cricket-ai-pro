import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, type Tournament } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tournaments")({
  component: () => (<AppShell><Tournaments /></AppShell>),
});

function Tournaments() {
  const [items, setItems] = useState<Tournament[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", format: "T20", teams_count: 8, start_date: "" });
  const [teams, setTeams] = useState("Royals, Strikers, Knights, Titans, Warriors, Kings, Lions, Hawks");
  const [busy, setBusy] = useState(false);

  const load = () => api<Tournament[]>("/api/tournaments").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      const teamList = teams.split(",").map((t) => t.trim()).filter(Boolean);
      await api("/api/tournaments", { method: "POST", body: JSON.stringify({ ...form, teams: teamList }) });
      toast.success("Tournament created with AI-generated schedule");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Tournaments</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">All tournaments</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" /> New tournament</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create tournament</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="College Premier League" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="T20">T20</SelectItem>
                      <SelectItem value="ODI">ODI</SelectItem>
                      <SelectItem value="T10">T10</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Start date</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Teams (comma separated)</Label>
                <Input value={teams} onChange={(e) => setTeams(e.target.value)} />
                <p className="text-xs text-muted-foreground">AI will auto-generate a round-robin schedule.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={busy || !form.name || !form.start_date}>
                {busy ? "Generating…" : "Create & schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-16 text-center">
          <Trophy className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No tournaments yet. Create your first one.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <Link key={t.id} to="/tournaments/$id" params={{ id: String(t.id) }}>
              <Card className="group h-full border-border p-6 transition-colors hover:border-foreground">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.format}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">{t.name}</h3>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t.teams_count} teams</span>
                  <span>{new Date(t.start_date).toLocaleDateString()}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
