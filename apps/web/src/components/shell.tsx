"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ScrollText, Server, Terminal, Users } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ErrorBlock } from "@/components/async-state";
import { cn } from "@/lib/utils";
import type { ServerSummary } from "@/lib/types";

const NAV = [
  { href: "/", label: "Prehľad", icon: Activity },
  { href: "/console", label: "Konzola", icon: Terminal },
  { href: "/players", label: "Hráči", icon: Users },
  { href: "/audit", label: "Audit", icon: ScrollText },
  { href: "/servers", label: "Servery", icon: Server },
];

type Boot = {
  demo: boolean;
  mode: "demo" | "postgres";
  user: { id: string; name: string; email: string };
  servers: ServerSummary[];
};

type OpsValue = {
  demo: boolean;
  mode: "demo" | "postgres";
  user: Boot["user"];
  servers: ServerSummary[];
  serverId: string | null;
  server: ServerSummary | null;
  setServerId: (id: string) => void;
  refresh: () => Promise<void>;
};

const OpsContext = createContext<OpsValue | null>(null);

export function useOps() {
  const value = useContext(OpsContext);
  if (!value) throw new Error("useOps mimo Shell");
  return value;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [boot, setBoot] = useState<Boot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [serverId, setServerIdState] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/app/bootstrap", { cache: "no-store" });
    if (response.status === 401) {
      setNeedsLogin(true);
      setBoot(null);
      return;
    }
    if (!response.ok) throw new Error("bootstrap");
    const data = (await response.json()) as Boot;
    setNeedsLogin(false);
    setBoot(data);
    setServerIdState((current) => {
      const stored = window.localStorage.getItem("craftops-server");
      const preferred = current || stored;
      if (preferred && data.servers.some((server) => server.id === preferred)) return preferred;
      return data.servers[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    refresh().catch(() => setError("Nepodarilo sa načítať účty a servery."));
  }, [refresh]);

  function setServerId(id: string) {
    setServerIdState(id);
    window.localStorage.setItem("craftops-server", id);
  }

  const server = boot?.servers.find((item) => item.id === serverId) ?? null;
  const value = useMemo<OpsValue | null>(() => {
    if (!boot?.user) return null;
    return {
      demo: boot.demo,
      mode: boot.mode,
      user: boot.user,
      servers: boot.servers,
      serverId,
      server,
      setServerId,
      refresh,
    };
  }, [boot, refresh, server, serverId]);

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-border bg-card/70 md:flex">
        <Brand />
        <Nav pathname={pathname} />
        <p className="mt-auto px-4 py-4 text-[11px] leading-relaxed text-muted-foreground">
          PWA pre majiteľa Fabric servera. TPS, MSPT a RCON ostávajú v angličtine.
        </p>
      </aside>
      <div className="md:pl-56">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
          <div className="md:hidden">
            <Brand compact />
          </div>
          {server ? (
            <label className="min-w-0 flex-1">
              <span className="sr-only">Server</span>
              <select
                className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-2 text-sm"
                value={server.id}
                onChange={(event) => setServerId(event.target.value)}
              >
                {boot?.servers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="flex-1" />
          )}
          {server ? (
            <div className="hidden items-center gap-2 font-mono text-xs text-muted-foreground sm:flex">
              <span className={cn("h-2 w-2 rounded-full", server.stopped ? "bg-destructive" : "ops-pulse bg-ok")} />
              {server.stopped ? "zastavený" : `${server.playersOnline} online`}
              {server.tps != null ? <span>TPS {server.tps.toFixed(1)}</span> : null}
            </div>
          ) : null}
          {boot?.demo ? <span className="rounded-sm bg-primary/15 px-2 py-1 text-[11px] font-medium text-primary">Ukážka</span> : null}
          <span className="hidden text-xs text-muted-foreground lg:inline">{boot?.user.name}</span>
        </header>
        {boot?.demo ? (
          <p className="border-b border-border bg-primary/10 px-4 py-2 text-xs text-foreground">
            Ukážkový režim. Discord nie je nastavený, takže ste tu ako Demo Majiteľ. Údaje sú lokálne, nie v Neon.
          </p>
        ) : null}
        <main className="px-4 py-4 pb-24 md:px-6 md:pb-8">
          {error ? (
            <ErrorBlock message={error} onRetry={() => refresh().catch(() => setError("Nepodarilo sa načítať účty a servery."))} />
          ) : needsLogin ? (
            <div className="mx-auto max-w-md rounded-md border border-border bg-card p-6">
              <h1 className="text-lg font-semibold">Prihlásenie cez Discord</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Discord aplikácia je nakonfigurovaná. Pokračujte účtom majiteľa.
              </p>
              <a className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/api/auth/signin">
                Prihlásiť sa
              </a>
            </div>
          ) : !value ? (
            <div className="space-y-3" aria-busy="true">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Načítavam servery…</p>
              <div className="h-28 animate-pulse rounded-md bg-muted" />
              <div className="h-64 animate-pulse rounded-md bg-muted" />
            </div>
          ) : (
            <OpsContext.Provider value={value}>{children}</OpsContext.Provider>
          )}
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur md:hidden">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn("flex flex-1 flex-col items-center gap-1 py-2 text-[10px]", active ? "text-primary" : "text-muted-foreground")}>
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", compact ? "" : "px-4 py-4")}>
      <span className="grid h-8 w-8 place-items-center rounded-md bg-primary font-mono text-sm font-semibold text-primary-foreground">C</span>
      {compact ? null : (
        <div>
          <div className="text-sm font-semibold tracking-wide">CraftOps</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Fabric server</div>
        </div>
      )}
    </div>
  );
}

function Nav({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col gap-1 px-2">
      {NAV.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-2 text-sm",
              active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
