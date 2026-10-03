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
| Neon PostgreSQL | Not connected. `apps/web/prisma/schema.prisma` is the PostgreSQL schema. With `DATABASE_URL` unset, accounts and telemetry live in `apps/web/.data/store.json`. |
| Discord | Optional. If `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are missing, email and password still work. Discord, when set, creates the same kind of user (`discordId` is optional). |
| Cloudflare KV | Not connected. `apps/widget` reads `mock-kv.json` and is only a public status badge. It is not a second database client. `src/sync.js` can pull `GET /api/v1/badge` when `CRAFTOPS_API` is set. |
| Stripe | Not implemented. Plan limits live in `apps/web/src/lib/plans.ts`. |
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

Copy `apps/web/.env.example` to `apps/web/.env.local` only if you want Discord or Postgres. Do not commit that file. Neither secret is required.

The UI is Slovak by default and English as well. The language switcher in the header sets the `craftops-lang` cookie (`sk` or `en`). TPS, MSPT, and RCON stay in English.

## Accounts and plans

Sign in with email and password. Registration is on the same screen. Passwords are stored as scrypt hashes, never plaintext.

Two seeded Free-plan accounts are already in the local store. Each one sees only its own server:

| Email | Password | Server |
| --- | --- | --- |
| `majitel@craftops.local` | `demo-hory` | Hory a Doly |
| `peter@craftops.local` | `demo-bana` | Dúbravská Baňa |

Signing in as one of them does not sign you in as the other. A newly registered account starts on Free with no servers.

Free limits, enforced now: **1 server**, telemetry and audit retained for **7 days**. Pro limits exist only as data (**10 servers**, **90 days**) and there is no checkout. The servers screen shows usage, for example `1 / 1 · Zadarmo` or `1 / 1 · Free`. Rows older than the retention window are not returned.

## Ingest API

The Fabric mod never talks to the database. It calls this app over HTTP. The only credential is the server secret (`Server.apiKey`), sent as `x-api-key`. Requests without that header are rejected. A user session is not accepted as a substitute for ingest.

- `POST /api/v1/telemetry` and `POST /api/v1/events` require `x-api-key`
- `GET /api/v1/cmd` with `x-api-key` returns pending commands for that server
- `POST /api/v1/cmd` with `{ "ack": [...] }` and `x-api-key` confirms them
- The signed-in owner enqueues with `{ "serverId", "action", "args" }` or `{ "serverId", "line" }`. The server must belong to that user.
- `GET /api/v1/badge?server=` is the public badge payload (no secret)

Demo keys: `CO_DEMO_HORYADOLY_7F3A9C2E` and `CO_DEMO_DUBRAVA_4C81B6D0`.

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

The mod posts telemetry and events with header `x-api-key`, and polls `GET /api/v1/cmd`. It does not open Postgres and it does not embed a user session. Actions run on the server thread: `/stop`, `/kick`, `/ban`, `/teleport`, `/give`, `/broadcast`, heal, op, deop, clear entity drops, and raw console commands.

Demo server ids: `srv_hory_a_doly`, `srv_dubravska_bana`.
