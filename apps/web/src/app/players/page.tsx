"use client";

import { useEffect, useState } from "react";

import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/async-state";
import { useOps } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dimensionLabel, formatCoords } from "@/lib/format";
import type { PlayerRecord } from "@/lib/types";

export default function PlayersPage() {
  const { serverId, refresh } = useOps();
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [selected, setSelected] = useState<PlayerRecord | null>(null);
  const [reason, setReason] = useState("Porušenie pravidiel");
  const [duration, setDuration] = useState("3600");
  const [item, setItem] = useState("minecraft:bread");
  const [count, setCount] = useState("8");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Hráči · CraftOps";
  }, []);

  async function load() {
    if (!serverId) return;
    setStatus("loading");
    try {
      const response = await fetch(`/api/app/players?serverId=${encodeURIComponent(serverId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("players");
      const json = (await response.json()) as { players: PlayerRecord[] };
      setPlayers(json.players);
      setStatus("ready");
      setSelected((current) => (current ? json.players.find((player) => player.id === current.id) ?? current : null));
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  async function act(action: string, args: Record<string, string>) {
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
      await load();
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Príkaz sa nepodarilo zaradiť.");
    } finally {
      setBusy(false);
    }
  }

  if (!serverId) return <EmptyBlock title="Žiadny server" body="Hráči sa zobrazia, keď vyberiete server." />;
  if (status === "loading") return <LoadingBlock label="Načítavam hráčov…" />;
  if (status === "error") return <ErrorBlock message="Zoznam hráčov sa nepodarilo načítať." onRetry={() => void load()} />;

  const online = players.filter((player) => player.online);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Správca hráčov</h1>
        <p className="text-sm text-muted-foreground">{online.length} online · {players.length - online.length} nedávno odišlo</p>
      </div>
      {online.length === 0 ? (
        <EmptyBlock title="Na serveri nie je žiadny hráč" body="Keď sa niekto pripojí, mod pošle zoznam v telemetrii. V ukážke sú hráči predvyplnení, kým ich nevyhodíte." />
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <div className="hidden grid-cols-[1.3fr_0.6fr_0.8fr_0.9fr_0.6fr_1fr] gap-2 border-b border-border px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:grid">
            <span>Hráč</span><span>Ping</span><span>Dimenzia</span><span>Zdravie</span><span>Jedlo</span><span>Pozícia</span>
          </div>
          {online.map((player) => (
            <button key={player.id} type="button" onClick={() => { setSelected(player); setNotice(null); }} className="grid w-full gap-1 border-b border-border px-3 py-3 text-left last:border-b-0 hover:bg-accent md:grid-cols-[1.3fr_0.6fr_0.8fr_0.9fr_0.6fr_1fr] md:items-center">
              <span className="font-medium">
                {player.username} {player.operator ? <Badge className="ml-1">OP</Badge> : null}
                {player.health < 8 ? <Badge className="ml-1 border-destructive/40 text-destructive">nízke HP</Badge> : null}
              </span>
              <span className="font-mono text-sm">{player.ping} ms</span>
              <span className="text-sm">{dimensionLabel(player.dimension)}</span>
              <span className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full bg-ok" style={{ width: `${Math.min(100, (player.health / 20) * 100)}%` }} />
                </span>
                {player.health.toFixed(0)}
              </span>
              <span className="font-mono text-sm">{player.food}/20</span>
              <span className="font-mono text-xs text-muted-foreground">{formatCoords(player.x, player.y, player.z)}</span>
            </button>
          ))}
        </div>
      )}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.username}</DialogTitle>
                <DialogDescription className="font-mono text-xs">{selected.uuid}</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-muted-foreground">Dimenzia</dt><dd>{dimensionLabel(selected.dimension)}</dd></div>
                <div><dt className="text-muted-foreground">Ping</dt><dd className="font-mono">{selected.ping} ms</dd></div>
                <div><dt className="text-muted-foreground">Zdravie</dt><dd className="font-mono">{selected.health.toFixed(1)} / 20</dd></div>
                <div><dt className="text-muted-foreground">Jedlo</dt><dd className="font-mono">{selected.food}/20</dd></div>
                <div className="col-span-2"><dt className="text-muted-foreground">Súradnice</dt><dd className="font-mono">{formatCoords(selected.x, selected.y, selected.z)}</dd></div>
              </dl>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="reason">Dôvod</Label>
                  <Input id="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
                </div>
                <Button variant="destructive" disabled={busy} onClick={() => act("kick", { player: selected.username, reason })}>Kick</Button>
                <div className="flex gap-2">
                  <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={duration} onChange={(event) => setDuration(event.target.value)} aria-label="Trvanie banu">
                    <option value="3600">1 hodina</option>
                    <option value="86400">24 hodín</option>
                    <option value="604800">7 dní</option>
                  </select>
                  <Button variant="outline" disabled={busy} onClick={() => act("ban", { player: selected.username, reason, durationSeconds: duration })}>Dočasný ban</Button>
                </div>
                <Button variant="outline" disabled={busy} onClick={() => act("teleport", { player: selected.username, spawn: "true" })}>Teleport na spawn</Button>
                <Button variant="outline" disabled={busy} onClick={() => act("heal", { player: selected.username })}>Vyliečiť</Button>
                <Button variant="secondary" disabled={busy} onClick={() => act(selected.operator ? "deop" : "op", { player: selected.username })}>{selected.operator ? "Deop" : "Op"}</Button>
                <div className="flex gap-2 sm:col-span-2">
                  <Input value={item} onChange={(event) => setItem(event.target.value)} aria-label="Predmet" />
                  <Input className="w-20" value={count} onChange={(event) => setCount(event.target.value)} aria-label="Počet" />
                  <Button disabled={busy} onClick={() => act("give", { player: selected.username, item, count })}>Dať predmet</Button>
                </div>
              </div>
              {notice ? <p className="mt-3 text-sm text-muted-foreground">{notice}</p> : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
