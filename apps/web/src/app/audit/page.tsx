"use client";

import { FormEvent, useEffect, useState } from "react";

import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/async-state";
import { useOps } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auditLabel, dimensionLabel, formatCoords, formatWhen, toLocalInput } from "@/lib/format";
import type { AuditRecord } from "@/lib/types";

export default function AuditPage() {
  const { serverId } = useOps();
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [entries, setEntries] = useState<AuditRecord[]>([]);
  const [player, setPlayer] = useState("");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState(() => toLocalInput(new Date(Date.now() - 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => toLocalInput(new Date()));

  useEffect(() => {
    document.title = "Audit · CraftOps";
  }, []);

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

  if (!serverId) return <EmptyBlock title="Žiadny server" body="Audit sa viaže na konkrétny server." />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit</h1>
        <p className="text-sm text-muted-foreground">Chat, príkazy, pripojenia a smrť. Filtrujte podľa hráča, typu a času.</p>
      </div>
      <form onSubmit={load} className="grid gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-5">
        <div className="space-y-1">
          <Label htmlFor="player">Hráč</Label>
          <Input id="player" value={player} onChange={(event) => setPlayer(event.target.value)} placeholder="Kubko" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="type">Typ</Label>
          <select id="type" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">Všetky typy</option>
            <option value="chat">Chat</option>
            <option value="command">Príkaz</option>
            <option value="join">Pripojenie</option>
            <option value="leave">Odpojenie</option>
            <option value="death">Smrť</option>
            <option value="action">Akcia</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="from">Od</Label>
          <Input id="from" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">Do</Label>
          <Input id="to" type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full">Hľadať</Button>
        </div>
      </form>
      {status === "loading" ? <LoadingBlock label="Hľadám v audite…" /> : null}
      {status === "error" ? <ErrorBlock message="Audit sa nepodarilo načítať." onRetry={() => void load()} /> : null}
      {status === "ready" && entries.length === 0 ? (
        <EmptyBlock title="Žiadne záznamy nevyhovujú filtru" body="Skúste širší čas alebo iného hráča. Chat a príkazy sa ukladajú, keď ich mod pošle." />
      ) : null}
      {status === "ready" && entries.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{entries.length} záznamov</p>
          {entries.map((entry) => (
            <article key={entry.id} className="grid gap-1 rounded-md border border-border bg-card px-3 py-2 md:grid-cols-[9rem_6rem_8rem_1fr_10rem] md:items-center">
              <span className="font-mono text-xs text-muted-foreground">{formatWhen(entry.timestamp)}</span>
              <Badge>{auditLabel(entry.type)}</Badge>
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
