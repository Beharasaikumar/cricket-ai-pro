import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Trophy, LayoutDashboard, Radio, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/live", label: "Live", icon: Radio },
  { to: "/analysis", label: "AI Analysis", icon: Sparkles },
];

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Trophy className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">CricketAI</span>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = loc.pathname === n.to || (n.to !== "/" && loc.pathname.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}
