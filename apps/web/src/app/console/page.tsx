"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/async-state";
import { useI18n } from "@/components/i18n-provider";
import { useOps } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { formatClock } from "@/lib/format";
import { statusLabel } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AuditRecord, CommandRecord } from "@/lib/types";

const EXAMPLES = ["kick Kubko spam", "heal Dusanek", "title Záloha o 22:00 | svet sa reštartuje", "clear"];

export default function ConsolePage() {
  const { serverId, server } = useOps();
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [lines, setLines] = useState<AuditRecord[]>([]);
  const [queue, setQueue] = useState<CommandRecord[]>([]);
  const [line, setLine] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${t("nav.console")} · CraftOps`;
  }, [t]);

  useEffect(() => {
    if (!serverId) return;
    let cancelled = false;
    let timer = 0;
    async function load(initial: boolean) {
      try {
        const response = await fetch(`/api/app/console?serverId=${encodeURIComponent(serverId!)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("console");
        const json = (await response.json()) as { lines: AuditRecord[]; queue: CommandRecord[] };
        if (cancelled) return;
        setLines(json.lines);
        setQueue(json.queue);
        setStatus("ready");
      } catch {
        if (!cancelled && initial) setStatus("error");
      }
    }
    setStatus("loading");
    void load(true);
    timer = window.setInterval(() => void load(false), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [serverId, attempt]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!serverId || !line.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/v1/cmd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverId, line }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Príkaz sa nepodarilo zaradiť.");
      setLine("");
      setNotice(json.message);
      const fresh = await fetch(`/api/app/console?serverId=${encodeURIComponent(serverId)}`, { cache: "no-store" });
      if (fresh.ok) {
        const body = await fresh.json();
        setLines(body.lines);
        setQueue(body.queue);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("error.command"));
    } finally {
      setBusy(false);
    }
  }

  if (!serverId) return <EmptyBlock title={t("empty.noServer.title")} body={t("empty.noServer.console")} />;
  if (status === "loading") return <LoadingBlock label={t("loading.console")} />;
  if (status === "error") return <ErrorBlock message={t("error.console")} onRetry={() => setAttempt((value) => value + 1)} />;

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("console.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("console.hint")}</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <div className="flex h-[calc(100dvh-16rem)] min-h-[420px] flex-col overflow-hidden rounded-md border border-border bg-[#14110e]">
          <div ref={scroller} className="flex-1 space-y-0.5 overflow-auto p-3 font-mono text-[13px] leading-6">
            {lines.length === 0 ? (
              <p className="text-muted-foreground">{t("empty.console")}</p>
            ) : (
              lines.map((entry) => (
                <div key={entry.id} className={cn("grid grid-cols-[4.5rem_5.5rem_1fr] gap-2", `console-line-${entry.type}`)}>
                  <span className="text-[#6d645b]">{formatClock(entry.timestamp, locale)}</span>
                  <span className="uppercase tracking-wide text-[11px] leading-6">{entry.type}</span>
                  <span>
                    {entry.player ? <span className="text-[#c8b8a4]">{entry.player} </span> : null}
                    {entry.message}
                  </span>
                </div>
              ))
            )}
          </div>
          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border px-3 py-2 font-mono text-sm">
            <span className="text-primary">›</span>
            <input
              value={line}
              onChange={(event) => setLine(event.target.value)}
              placeholder="kick Kubko spam"
              className="h-8 flex-1 bg-transparent outline-none placeholder:text-[#6d645b]"
              aria-label={t("console.input")}
              disabled={busy}
            />
          </form>
        </div>
        <aside className="space-y-3">
          <div className="rounded-md border border-border bg-card p-3">
            <h2 className="text-sm font-semibold">{t("console.queue")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{server?.name}</p>
            <ul className="mt-3 space-y-2">
              {queue.length === 0 ? <li className="text-sm text-muted-foreground">{t("empty.queue")}</li> : null}
              {queue.map((command) => (
                <li key={command.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono">{command.action}</span>
                    <Badge>{statusLabel(locale, command.status)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{command.result || Object.values(command.args).filter(Boolean).join(" · ") || t("common.noArgs")}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button key={example} type="button" className="rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setLine(example)}>
                {example}
              </button>
            ))}
          </div>
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
        </aside>
      </div>
    </div>
  );
}
