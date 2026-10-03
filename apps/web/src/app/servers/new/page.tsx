"use client";

import { FormEvent, useEffect, useState } from "react";

import { useOps } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Created = { server: { id: string; name: string; apiKey: string }; config: string };

export default function NewServerPage() {
  const { refresh, setServerId } = useOps();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = "Nový server · CraftOps";
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/app/servers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Server sa nepodarilo vytvoriť.");
      setCreated(json);
      await refresh();
      setServerId(json.server.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Server sa nepodarilo vytvoriť.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nový server</h1>
        <p className="text-sm text-muted-foreground">Po vytvorení dostanete API kľúč do config/craftops.json.</p>
      </div>
      {created ? (
        <div className="space-y-3 rounded-md border border-primary/40 bg-card p-4">
          <h2 className="text-lg font-semibold">{created.server.name} je vytvorený</h2>
          <p className="text-sm text-muted-foreground">
            API kľúč vložte na Fabric server. V ukážke ho uvidíte aj v zozname serverov. Do chatu ho neposielajte.
          </p>
          <p className="break-all font-mono text-sm">{created.server.apiKey}</p>
          <pre className="overflow-x-auto rounded-md bg-black/40 p-3 font-mono text-xs leading-relaxed">{created.config}</pre>
          <p className="text-xs text-muted-foreground">Na produkcii zmeňte endpoint na https://craftops.app/api/v1.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(created.config);
                setCopied(true);
              }}
            >
              {copied ? "Skopírované" : "Kopírovať JSON"}
            </Button>
            <Button asChild>
              <a href="/">Otvoriť prehľad</a>
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-border bg-card p-4">
          <div className="space-y-1">
            <Label htmlFor="name">Názov servera</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Hory a Doly" required minLength={2} maxLength={48} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={busy}>{busy ? "Vytváram…" : "Vytvoriť server"}</Button>
        </form>
      )}
    </div>
  );
}
