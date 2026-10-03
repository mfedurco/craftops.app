# CraftOps

Micro-SaaS for owners of Fabric Minecraft servers: live telemetry, audit, and remote actions from a browser PWA. The Fabric mod is server-side only. Clients do not install it.

## Layout

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, Recharts, Prisma, NextAuth.js (Discord) |
| `apps/mod` | Fabric mod for Minecraft **1.20.1**, Java 21. Loader-agnostic code is in `core/`, Fabric is a thin adapter. See `apps/mod/ARCHITECTURE.md`. |
| `apps/widget` | Cloudflare Worker that serves an SVG/HTML status badge from a KV-shaped cache |

JavaScript apps use pnpm workspaces. The mod is Gradle.

## What is real, and what is mocked

| Piece | This checkout |
| --- | --- |
| Neon PostgreSQL | Not connected. `apps/web/prisma/schema.prisma` is the PostgreSQL schema. With `DATABASE_URL` unset, the UI uses a JSON demo store in `apps/web/.data/store.json`, seeded with 7 days of TPS/MSPT/RAM, players, and Slovak audit lines. |
| Discord | Not connected. If `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are missing, you are the labeled demo owner. NextAuth Discord is wired for when the secrets exist. |
| Cloudflare KV | Not connected. `apps/widget` reads `mock-kv.json`. `src/sync.js` can pull `GET /api/v1/badge` when `CRAFTOPS_API` is set. |
| NeoForge | Not implemented. `core` defines `PlatformBridge`; a future `neoforge/` project would implement it. |

Set `DATABASE_URL` to a Postgres URL (Neon) and run `pnpm --filter @craftops/web exec prisma db push` to leave the demo store. Do not point that URL at SQLite. The Prisma schema is PostgreSQL.

## Run the web app

```bash
pnpm install
pnpm dev
```

The dev server listens on `0.0.0.0:38471`. Open http://127.0.0.1:38471.

Production build:

```bash
pnpm build
```

Copy `apps/web/.env.example` if you want Discord or Postgres. Neither is required for the demo.

## Run the status badge

```bash
pnpm dev:widget
```

http://127.0.0.1:38472/badge.svg?server=srv_hory_a_doly

Optional minute sync against a running web app:

```bash
CRAFTOPS_API=http://127.0.0.1:38471 pnpm --filter @craftops/widget sync
```

`wrangler.toml` targets `widget.craftops.app` and a placeholder KV id. It is not deployed.

## Run the mod

Minecraft 1.20.1, Yarn `1.20.1+build.10`, Fabric Loader 0.16.10, Fabric API `0.92.12+1.20.1`, Loom 1.13.6, Gradle 8.14.3, Java 21. Loom 1.18 requires a Java 25 Gradle runtime. Loom 1.8 runs on Java 21 but does not remap Java 21 class files, so the wrapper stays on Loom 1.13.6 and Gradle 8.14.3.

```bash
cd apps/mod
./gradlew :core:test :fabric:build
```

Put the remapped jar from `apps/mod/fabric/build/libs/` into the server `mods/` folder together with Fabric API. On first launch the mod writes `config/craftops.json`:

```json
{
  "api_key": "CO_SERVER_UUID_TOKEN",
  "endpoint": "https://craftops.app/api/v1",
  "telemetry_interval_seconds": 10
}
```

Replace `api_key` with the key from the CraftOps “Nový server” screen. For this dev server set `endpoint` to `http://127.0.0.1:38471/api/v1`. While the key is still the placeholder, the mod does not call the network.

The mod posts telemetry and events with header `x-api-key`, and polls `GET /api/v1/cmd`. Actions run on the server thread: `/stop`, `/kick`, `/ban`, `/teleport`, `/give`, `/broadcast`, heal, op, deop, clear entity drops, and raw console commands.

## API

- `POST /api/v1/telemetry` and `POST /api/v1/events` require `x-api-key`
- `GET /api/v1/cmd` returns pending commands for that key and marks them delivered
- `POST /api/v1/cmd` with `{ "ack": [...] }` confirms them; the dashboard posts `{ "serverId", "action", "args" }` or `{ "serverId", "line" }`
- `GET /api/v1/badge?server=` is the public badge payload

Demo server id: `srv_hory_a_doly`. Demo key: `CO_DEMO_HORYADOLY_7F3A9C2E`.
