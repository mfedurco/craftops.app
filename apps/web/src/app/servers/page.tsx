"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyBlock } from "@/components/async-state";
import { useI18n } from "@/components/i18n-provider";
import { useOps } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { craftOpsJson } from "@/lib/format";

export default function ServersPage() {
  const { servers, usage } = useOps();
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);
  const [badgeDown, setBadgeDown] = useState(false);
  const atCap = usage.serverCount >= usage.maxServers;

  useEffect(() => {
    document.title = `${t("servers.title")} · CraftOps`;
  }, [t]);

  async function copy(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
  }

  const usageLine = `${t("plan.usage", { count: usage.serverCount, max: usage.maxServers })} · ${t(usage.plan === "pro" ? "plan.pro" : "plan.free")}`;

  if (servers.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{t("servers.title")}</h1>
        <p className="font-mono text-sm text-muted-foreground">{usageLine}</p>
        <p className="text-sm text-muted-foreground">{t("plan.retention", { days: usage.retentionDays })}</p>
        <EmptyBlock title={t("empty.servers.title")} body={t("empty.servers.body")} />
        {atCap ? (
          <p className="text-sm text-muted-foreground">{t("plan.cap", { plan: t(usage.plan === "pro" ? "plan.pro" : "plan.free"), max: usage.maxServers })}</p>
        ) : (
          <Button asChild><Link href="/servers/new">{t("servers.add")}</Link></Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("servers.title")}</h1>
          <p className="font-mono text-sm">{usageLine}</p>
          <p className="text-sm text-muted-foreground">{t("servers.own")}</p>
          <p className="text-xs text-muted-foreground">{t("plan.retention", { days: usage.retentionDays })}</p>
        </div>
        {atCap ? (
          <p className="max-w-xs text-sm text-muted-foreground">{t("plan.cap", { plan: t(usage.plan === "pro" ? "plan.pro" : "plan.free"), max: usage.maxServers })}</p>
        ) : (
          <Button asChild><Link href="/servers/new">{t("servers.add")}</Link></Button>
        )}
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
              <p className="mt-1 text-sm text-muted-foreground">{server.motd || t("servers.noMotd")}</p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t("servers.apiKey")}</p>
              <p className="mt-1 break-all font-mono text-sm">{server.apiKey}</p>
              <pre className="mt-3 overflow-x-auto rounded-md bg-black/40 p-3 font-mono text-xs leading-relaxed">{config}</pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => copy(server.id, config)}>
                  {copied === server.id ? t("servers.copied") : t("servers.copy")}
                </Button>
              </div>
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{t("servers.badge")}</p>
                {badgeDown ? (
                  <p className="mt-2 text-sm text-muted-foreground">{t("servers.badgeDown")}</p>
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
