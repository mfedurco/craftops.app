"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyBlock } from "@/components/async-state";
import { useOps } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { craftOpsJson } from "@/lib/format";

export default function ServersPage() {
  const { servers, demo } = useOps();
  const [copied, setCopied] = useState<string | null>(null);
  const [badgeDown, setBadgeDown] = useState(false);

  useEffect(() => {
    document.title = "Servery · CraftOps";
  }, []);

  async function copy(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
  }

  if (servers.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Servery</h1>
        <EmptyBlock title="Zatiaľ nemáte server" body="Vytvorte ho a API kľúč vložte do config/craftops.json na Fabric serveri." />
        <Button asChild><Link href="/servers/new">Pridať server</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Servery</h1>
          <p className="text-sm text-muted-foreground">{demo ? "Ukážkový kľúč ide do lokálneho modu." : "Kľúč patrí len majiteľovi."}</p>
        </div>
        <Button asChild><Link href="/servers/new">Pridať server</Link></Button>
      </div>
      <div className="space-y-3">
        {servers.map((server) => {
          const config = craftOpsJson(server.apiKey);
          const badge = `http://127.0.0.1:38472/badge.svg?server=${server.id}`;
          return (
            <article key={server.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{server.name}</h2>
                <span className="font-mono text-xs text-muted-foreground">{server.version} · {server.playersOnline}/{server.maxPlayers}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{server.motd || "Bez MOTD"}</p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">API kľúč</p>
              <p className="mt-1 break-all font-mono text-sm">{server.apiKey}</p>
              <pre className="mt-3 overflow-x-auto rounded-md bg-black/40 p-3 font-mono text-xs leading-relaxed">{config}</pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => copy(server.id, config)}>
                  {copied === server.id ? "Skopírované" : "Kopírovať JSON"}
                </Button>
              </div>
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Odznak pre fórum</p>
                {badgeDown ? (
                  <p className="mt-2 text-sm text-muted-foreground">Lokálny widget nebeží. Spustite pnpm dev:widget na porte 38472.</p>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={badge} alt={`${server.name} status`} className="mt-2 h-9" onError={() => setBadgeDown(true)} />
                )}
                <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{badge}</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
