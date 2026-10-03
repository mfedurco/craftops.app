"use client";

import { FormEvent, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { useOps } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Created = { server: { id: string; name: string; apiKey: string }; config: string };

export default function NewServerPage() {
  const { refresh, setServerId, usage } = useOps();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);
  const atCap = usage.serverCount >= usage.maxServers;

  useEffect(() => {
    document.title = `${t("new.title")} · CraftOps`;
  }, [t]);

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
      if (!response.ok) throw new Error(json.error || t("new.failed"));
      setCreated(json);
      await refresh();
      setServerId(json.server.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("new.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("new.title")}</h1>
        <p className="font-mono text-sm">{t("plan.usage", { count: usage.serverCount, max: usage.maxServers })} · {t(usage.plan === "pro" ? "plan.pro" : "plan.free")}</p>
        <p className="text-sm text-muted-foreground">{t("new.hint")}</p>
      </div>
      {atCap && !created ? (
        <p className="rounded-md border border-border bg-card px-3 py-2 text-sm">{t("plan.cap", { plan: t(usage.plan === "pro" ? "plan.pro" : "plan.free"), max: usage.maxServers })}</p>
      ) : null}
      {created ? (
        <div className="space-y-3 rounded-md border border-primary/40 bg-card p-4">
          <h2 className="text-lg font-semibold">{t("new.created", { name: created.server.name })}</h2>
          <p className="text-sm text-muted-foreground">{t("new.secret")}</p>
          <p className="break-all font-mono text-sm">{created.server.apiKey}</p>
          <pre className="overflow-x-auto rounded-md bg-black/40 p-3 font-mono text-xs leading-relaxed">{created.config}</pre>
          <p className="text-xs text-muted-foreground">{t("new.prodEndpoint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(created.config);
                setCopied(true);
              }}
            >
              {copied ? t("servers.copied") : t("servers.copy")}
            </Button>
            <Button asChild>
              <a href="/">{t("new.open")}</a>
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-border bg-card p-4">
          <div className="space-y-1">
            <Label htmlFor="name">{t("new.name")}</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={48} disabled={atCap} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={busy || atCap}>{busy ? t("new.busy") : t("new.submit")}</Button>
        </form>
      )}
    </div>
  );
}
