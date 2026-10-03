import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Stránka neexistuje</h1>
      <p className="text-sm text-muted-foreground">Táto adresa v CraftOps nie je.</p>
      <Link href="/" className="text-sm text-primary">Späť na prehľad</Link>
    </div>
  );
}
