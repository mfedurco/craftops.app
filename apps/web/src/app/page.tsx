"use client";

import { useEffect, useState } from "react";

import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/async-state";
import { MetricChart } from "@/components/metric-charts";
import { useI18n } from "@/components/i18n-provider";
import { useOps } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatWhen } from "@/lib/format";
import { auditTypeLabel } from "@/lib/i18n";
import type { DashboardData } from "@/lib/types";

export default function DashboardPage() {
  const { serverId, refresh } = useOps();
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [data, setData] = useState<DashboardData | null>(null);
  const [range, setRange] = useState<"h24" | "d7">("h24");
  const [stopOpen, setStopOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `${t("nav.overview")} · CraftOps`;
  }, [t]);

  useEffect(() => {
    if (!serverId) return;
    let cancelled = false;
    setStatus("loading");
    fetch(`/api/app/dashboard?serverId=${encodeURIComponent(serverId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("dashboard");
        return response.json() as Promise<DashboardData>;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  async function reload() {
    if (!serverId) return;
    const response = await fetch(`/api/app/dashboard?serverId=${encodeURIComponent(serverId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("dashboard");
    setData(await response.json());
    setStatus("ready");
    await refresh();
  }

  async function send(action: string, args: Record<string, string>) {
    if (!serverId) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/v1/cmd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serverId, action, args }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Príkaz sa nepodarilo zaradiť.");
      setNotice(json.message);
      await reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("error.command"));
    } finally {
      setBusy(false);
      setStopOpen(false);
      setClearOpen(false);
    }
  }

  if (!serverId) {
    return <EmptyBlock title={t("empty.noServer.title")} body={t("empty.noServer.dashboard")} />;
  }
  if (status === "loading") return <LoadingBlock label={t("loading.telemetry")} />;
  if (status === "error" || !data) {
    return <ErrorBlock message={t("error.dashboard")} onRetry={() => reload().catch(() => setStatus("error"))} />;
  }

  const series = range === "h24" ? data.series.h24 : data.series.d7;
  const uptime = `${(data.kpis.uptimeRatio * 100).toLocaleString(locale === "en" ? "en-GB" : "sk-SK", { maximumFractionDigits: 1 })} %`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{data.server.version} · {data.server.motd || t("common.noMotd")}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{data.server.name}</h1>
        </div>
        <Tabs value={range} onValueChange={(value) => setRange(value as "h24" | "d7")}>
          <TabsList>
            <TabsTrigger value="h24">{t("dashboard.hours")}</TabsTrigger>
            <TabsTrigger value="d7">{t("dashboard.days")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {data.server.stopped ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">{t("dashboard.stopped")}</div>
      ) : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t("dashboard.uptime")} value={uptime} hint={data.kpis.uptimeLabel} />
        <Kpi label={t("dashboard.players")} value={`${data.kpis.playersOnline}`} hint={t("dashboard.ofMax", { max: data.kpis.maxPlayers })} />
        <Kpi label={t("dashboard.avgMspt")} value={data.kpis.avgMspt.toFixed(1)} hint={t("dashboard.now", { value: data.kpis.mspt.toFixed(1) })} />
        <Kpi label={t("dashboard.tpsNow")} value={data.kpis.tps.toFixed(1)} hint={t("dashboard.ram", { value: data.kpis.ramUsedMb.toLocaleString(locale === "en" ? "en-GB" : "sk-SK") })} />
      </section>
      {series.length === 0 ? (
        <EmptyBlock title={t("empty.noTelemetry.title")} body={t("empty.noTelemetry.body")} />
      ) : (
        <section className="grid gap-3 xl:grid-cols-3">
          <ChartCard title="TPS" series={series} dataKey="tps" color="#e0a15a" domain={[0, 20]} />
          <ChartCard title="MSPT" series={series} dataKey="mspt" color="#e07a5f" />
          <ChartCard title="RAM (MB)" series={series} dataKey="ram" color="#8fbf7f" />
        </section>
      )}
      <section className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.actions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" disabled={busy} onClick={() => setStopOpen(true)}>{t("dashboard.emergency")}</Button>
              <Button variant="outline" disabled={busy} onClick={() => setClearOpen(true)}>{t("dashboard.clearDrops")}</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="title">{t("dashboard.title")}</Label>
                <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="subtitle">{t("dashboard.subtitle")}</Label>
                <Input id="subtitle" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} />
              </div>
            </div>
            <Button disabled={busy || !title.trim()} onClick={() => send("broadcast", { title, subtitle })}>
              {t("dashboard.broadcast")}
            </Button>
            {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recent")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty.recent")}</p>
            ) : (
              data.recent.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <Badge>{auditTypeLabel(locale, entry.type)}</Badge>
                    <p className="mt-1">{entry.message}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatWhen(entry.timestamp, locale)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
      <Dialog open={stopOpen} onOpenChange={setStopOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.stopTitle")}</DialogTitle>
            <DialogDescription>{t("dashboard.stopBody")}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStopOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" disabled={busy} onClick={() => send("stop", {})}>{t("dashboard.stop")}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.clearTitle")}</DialogTitle>
            <DialogDescription>{t("dashboard.clearBody")}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setClearOpen(false)}>{t("common.cancel")}</Button>
            <Button disabled={busy} onClick={() => send("clear_drops", {})}>{t("dashboard.clear")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className="mt-2 font-mono text-3xl tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  series,
  dataKey,
  color,
  domain,
}: {
  title: string;
  series: DashboardData["series"]["h24"];
  dataKey: "tps" | "mspt" | "ram";
  color: string;
  domain?: [number, number];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <MetricChart data={series} dataKey={dataKey} color={color} domain={domain} />
      </CardContent>
    </Card>
  );
}
