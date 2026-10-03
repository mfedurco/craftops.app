"use client";

import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD, SECOND_OWNER_EMAIL, SECOND_OWNER_PASSWORD } from "@/lib/types";

const DEMOS = [
  { email: DEMO_OWNER_EMAIL, password: DEMO_OWNER_PASSWORD },
  { email: SECOND_OWNER_EMAIL, password: SECOND_OWNER_PASSWORD },
];

export function AuthScreen({ discord }: { discord: boolean }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(DEMO_OWNER_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login(nextEmail: string, nextPassword: string) {
    const result = await signIn("credentials", { email: nextEmail, password: nextPassword, redirect: false });
    if (!result || result.error) {
      setError(t("auth.failed"));
      return false;
    }
    window.location.assign("/");
    return true;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || t("auth.emailTaken"));
      }
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-border bg-card p-4">
        <div>
          <h1 className="text-xl font-semibold">{mode === "login" ? t("auth.login") : t("auth.register")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.lead")}</p>
        </div>
        {mode === "register" ? (
          <div className="space-y-1">
            <Label htmlFor="name">{t("auth.name")}</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={48} />
          </div>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
          {mode === "register" ? <p className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p> : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={busy}>{busy ? t("auth.busy") : mode === "login" ? t("auth.submitLogin") : t("auth.submitRegister")}</Button>
        <button
          type="button"
          className="block text-sm text-primary"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? t("auth.switchToRegister") : t("auth.switchToLogin")}
        </button>
        {discord ? (
          <Button type="button" variant="outline" onClick={() => signIn("discord", { callbackUrl: "/" })}>
            {t("auth.discord")}
          </Button>
        ) : null}
      </form>
      <aside className="space-y-3 rounded-md border border-border bg-card/60 p-4">
        <h2 className="text-sm font-semibold">{t("auth.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("auth.demoHint")}</p>
        {DEMOS.map((account) => (
          <Button
            key={account.email}
            type="button"
            variant="outline"
            className="w-full justify-start font-mono text-xs"
            disabled={busy}
            onClick={() => {
              setMode("login");
              setEmail(account.email);
              setPassword(account.password);
              setBusy(true);
              setError(null);
              login(account.email, account.password).finally(() => setBusy(false));
            }}
          >
            {t("auth.demoSignIn", { email: account.email })}
          </Button>
        ))}
      </aside>
    </div>
  );
}
