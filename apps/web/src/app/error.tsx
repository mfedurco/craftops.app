"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-3 rounded-md border border-destructive/40 bg-destructive/10 p-4" role="alert">
      <h1 className="text-lg font-semibold">Niečo sa pokazilo</h1>
      <p className="text-sm">{error.message || "Stránka sa nepodarila vykresliť."}</p>
      <Button variant="outline" onClick={reset}>Skúsiť znova</Button>
    </div>
  );
}
