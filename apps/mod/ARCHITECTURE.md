# Mod architecture

CraftOps ships one Gradle build with two projects:

| Project | Role |
| --- | --- |
| `core/` | Pure Java 21. No Fabric, NeoForge, or Minecraft imports. |
| `fabric/` | Thin dedicated-server adapter for Minecraft **1.20.1** (Yarn `1.20.1+build.10`, Fabric Loader 0.16.10, Fabric API `0.92.12+1.20.1`, Loom 1.13.6, Gradle 8.14.3). Loom 1.18 needs a Java 25 Gradle JVM. Loom 1.8 runs on Java 21 but its remapper drops Java 21 class files (major version 65), so this checkout uses Loom 1.13.6, which still runs on Java 21. |

Clients do not install the mod. `fabric.mod.json` sets `"environment": "server"` and the entrypoint is `DedicatedServerModInitializer`.

## The seam

`app.craftops.core.platform.PlatformBridge` is the only interface a loader implements.

Core owns:

- TPS and MSPT (`TpsTracker`) from tick-start intervals and in-tick durations
- telemetry and event JSON
- `config/craftops.json`
- `java.net.http` client (`x-api-key` on `/telemetry`, `/events`, `/cmd`)
- the inbound action protocol (`stop`, `kick`, `ban`, `teleport`, `give`, `broadcast`, `heal`, `op`, `deop`, `clear_drops`, `rcon`)

Fabric owns:

- registering tick, chat, join, leave, and death hooks
- a mixin on `CommandManager.executeWithPrefix` for player commands
- copying a player/uptime snapshot at the end of the server tick
- running each remote action with `MinecraftServer.execute` so the server thread is never blocked on HTTP

The I/O scheduler is a daemon pool in core. Gameplay hooks only enqueue. HTTP `sendAsync` never runs on the server thread.

If `api_key` is still `CO_SERVER_UUID_TOKEN`, core logs once and does not call the network.

## What a NeoForge adapter would do

Do not port gameplay into core. Add `neoforge/` as a third Gradle project that depends on `core` and implements `PlatformBridge`:

1. Subscribe to the NeoForge server tick, player login/logout, living death, and command events.
2. Call `TpsTracker.markTickStart` / `markTickEnd` with `System.nanoTime()`.
3. On tick end, publish the same `PlayerSnapshot` list core already serializes.
4. Implement kicks, bans, teleport, give, titles, heal, op, and item-entity clearing with NeoForge/Mojmap types.
5. Boot `CraftOpsRuntime.start(bridge, log)` from the NeoForge server entrypoint.
6. Keep reading `config/craftops.json`. Core does not change.

NeoForge is not implemented in this repository.

The mod never opens a database. It only POSTs telemetry and events and polls commands over HTTP, with header `x-api-key` set to the server secret from `config/craftops.json`. The web API checks that token and is the only component that writes to Prisma. There is no `DATABASE_URL` and no user session in the mod.
