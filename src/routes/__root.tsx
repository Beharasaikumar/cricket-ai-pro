import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CricketAI — Tournament Command Center" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&family=Barlow+Condensed:wght@700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap",
      },
    ],
  }),
  shellComponent: ({ children }: { children: React.ReactNode }) => (
    <html lang="en">
      <head><HeadContent /></head>
      <body style={{ margin: 0, background: "#06090f" }}>{children}<Scripts /></body>
    </html>
  ),
  component: () => (
    <AuthProvider>
      <Outlet />
      <Toaster theme="dark" position="bottom-right" />
    </AuthProvider>
  ),
  notFoundComponent: () => (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#06090f" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 96, fontWeight: 900, color: "#f0fdf4", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: "-4px" }}>404</div>
        <div style={{ color: "#6b7280", marginBottom: 24 }}>Page not found</div>
        <Link to="/" style={{ padding: "10px 24px", background: "#10b981", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>Go home</Link>
      </div>
    </div>
  ),
});