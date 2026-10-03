"use client";

import { FormEvent, useEffect, useState } from "react";

import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/async-state";
import { useI18n } from "@/components/i18n-provider";
import { useOps } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dimensionLabel, formatCoords, formatWhen, toLocalInput } from "@/lib/format";
import { auditTypeLabel } from "@/lib/i18n";
import type { AuditRecord } from "@/lib/types";

export default function AuditPage() {
  const { serverId, usage } = useOps();
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [entries, setEntries] = useState<AuditRecord[]>([]);
  const [player, setPlayer] = useState("");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState(() => toLocalInput(new Date(Date.now() - 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => toLocalInput(new Date()));

  useEffect(() => {
    document.title = `${t("nav.audit")} · CraftOps`;
  }, [t]);

  async function load(event?: FormEvent) {
    event?.preventDefault();
    if (!serverId) return;
    setStatus("loading");
    const params = new URLSearchParams({ serverId, player, type });
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    try {
      const response = await fetch(`/api/app/audit?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("audit");
      const json = (await response.json()) as { entries: AuditRecord[] };
      setEntries(json.entries);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  if (!serverId) return <EmptyBlock title={t("empty.noServer.title")} body={t("empty.noServer.audit")} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("audit.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("audit.hint")}</p>
        <p className="text-xs text-muted-foreground">{t("plan.retention", { days: usage.retentionDays })}</p>
      </div>
      <form onSubmit={load} className="grid gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-5">
        <div className="space-y-1">
          <Label htmlFor="player">{t("audit.player")}</Label>
          <Input id="player" value={player} onChange={(event) => setPlayer(event.target.value)} placeholder="Kubko" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="type">{t("audit.type")}</Label>
          <select id="type" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">{t("audit.all")}</option>
            <option value="chat">{auditTypeLabel(locale, "chat")}</option>
            <option value="command">{auditTypeLabel(locale, "command")}</option>
            <option value="join">{auditTypeLabel(locale, "join")}</option>
            <option value="leave">{auditTypeLabel(locale, "leave")}</option>
            <option value="death">{auditTypeLabel(locale, "death")}</option>
            <option value="action">{auditTypeLabel(locale, "action")}</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="from">{t("audit.from")}</Label>
          <Input id="from" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">{t("audit.to")}</Label>
          <Input id="to" type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full">{t("audit.search")}</Button>
        </div>
      </form>
      {status === "loading" ? <LoadingBlock label={t("loading.audit")} /> : null}
      {status === "error" ? <ErrorBlock message={t("error.audit")} onRetry={() => void load()} /> : null}
      {status === "ready" && entries.length === 0 ? (
        <EmptyBlock title={t("empty.audit.title")} body={t("empty.audit.body")} />
      ) : null}
      {status === "ready" && entries.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("audit.count", { count: entries.length })}</p>
          {entries.map((entry) => (
            <article key={entry.id} className="grid gap-1 rounded-md border border-border bg-card px-3 py-2 md:grid-cols-[9rem_6rem_8rem_1fr_10rem] md:items-center">
              <span className="font-mono text-xs text-muted-foreground">{formatWhen(entry.timestamp, locale)}</span>
              <Badge>{auditTypeLabel(locale, entry.type)}</Badge>
              <span className="text-sm">{entry.player ?? "—"}</span>
              <p className="text-sm">{entry.message}</p>
              <span className="font-mono text-[11px] text-muted-foreground">
                {dimensionLabel(entry.dimension)} · {formatCoords(entry.x, entry.y, entry.z)}
              </span>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
