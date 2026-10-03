import type { AuditRecord, AuditType, CommandRecord, PlayerRecord, ServerRecord, StoreData, TelemetryPoint } from "./types";
import { DEMO_API_KEY, DEMO_OWNER_ID, DEMO_SERVER_ID } from "./types";

const SERVER = DEMO_SERVER_ID;

function iso(ms: number) {
  return new Date(ms).toISOString();
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function buildSeed(now = Date.now()): StoreData {
  const restartedAt = now - 36 * 60 * 60 * 1000;
  const telemetry: TelemetryPoint[] = [];
  const step = 5 * 60 * 1000;
  const start = now - 7 * 24 * 60 * 60 * 1000;
  let ram = 2900;
  for (let t = start; t <= now; t += step) {
    const index = telemetry.length;
    const ageH = (now - t) / 3_600_000;
    const hour = new Date(t).getUTCHours();
    const evening = hour >= 16 && hour <= 21;
    const incident = (ageH > 6 && ageH < 6.5) || (ageH > 52 && ageH < 53);
    let mspt = 8.5 + 5 * Math.abs(Math.sin(index / 11)) + (evening ? 2.4 : 0);
    if (incident) mspt = 62 + (index % 6) * 4;
    else if (index % 80 === 0) mspt = 28;
    const tps = mspt <= 50 ? round1(19.6 + (index % 5) * 0.1) : round1(Math.min(20, 1000 / mspt));
    ram += evening ? 42 : 18;
    if (index % 34 === 0) ram = 2700 + (index % 180);
    ram = Math.min(ram, 7400);
    const playersOnline = incident ? 3 + (index % 2) : evening ? 7 + (index % 3) : 3 + (index % 3);
    telemetry.push({
      id: `tel_${t}`,
      serverId: SERVER,
      timestamp: iso(t),
      tps: Math.min(20, tps),
      mspt: round1(mspt),
      ramUsedMb: Math.round(ram),
      ramAllocMb: Math.min(8192, Math.round(ram + 900)),
      ramMaxMb: 8192,
      playersOnline,
      uptimeSeconds: Math.max(60, Math.floor((t - restartedAt) / 1000)),
    });
  }

  const players: PlayerRecord[] = [
    player("p_kubko", "3f1c2a40-7b21-4c0e-9a11-0b6d5e4f1001", "Kubko", 28, "minecraft:overworld", 184.5, 71, -402.2, 20, 18, false, true, 140, null, now),
    player("p_majka", "8ac01d22-1114-4a55-b902-77c0e1aa2202", "Majka", 54, "minecraft:overworld", 12.4, 64, 88.1, 16, 20, false, true, 80, null, now),
    player("p_jozef", "11aa90bc-55e0-4d21-8c77-9090abcd3303", "Banik_Jozef", 96, "minecraft:the_nether", 210.2, 68, -40.6, 11, 12, false, true, 45, null, now),
    player("p_lisa", "c0ffee00-1234-4abc-9def-0000aaa44404", "EnderLisa", 121, "minecraft:the_end", 8.5, 64, 22, 20, 14, false, true, 25, null, now),
    player("p_pixel", "5b5b1000-aaaa-4bbb-8ccc-ddddeeee5505", "Pixel", 17, "minecraft:overworld", 0.5, 80, 0.5, 20, 20, true, true, 300, null, now),
    player("p_dusan", "7777aaaa-bbbb-4ccc-8ddd-eeeeffff6606", "Dusanek", 63, "minecraft:overworld", -340.2, 12, 64.8, 6, 3, false, true, 15, null, now),
    player("p_noob", "9999bbbb-cccc-4ddd-8eee-ffff00007707", "Noobik", 40, "minecraft:overworld", 20, 70, -10, 0, 8, false, false, 200, 40, now),
    player("p_miso", "1212cccc-dddd-4eee-8fff-000011118808", "AFK_Miso", 200, "minecraft:overworld", 4, 65, 4, 20, 20, false, false, 500, 180, now),
  ];

  const script: Array<[number, AuditType, string | null, string, number | null, number | null, number | null, string | null]> = [
    [320, "join", "Pixel", "Pixel sa pripojil", 0.5, 80, 0.5, "minecraft:overworld"],
    [260, "chat", "Pixel", "ak niekto stavia pri spawne, nechajte cestu voľnú", 0.5, 80, 0.5, "minecraft:overworld"],
    [210, "join", "Noobik", "Noobik sa pripojil", 4, 64, 8, "minecraft:overworld"],
    [188, "command", "Noobik", "/spawn", 6, 64, 9, "minecraft:overworld"],
    [150, "join", "Kubko", "Kubko sa pripojil", 40, 68, -20, "minecraft:overworld"],
    [140, "chat", "Kubko", "kto ide do endu? mám oči, chýbajú ender perly", 42, 68, -18, "minecraft:overworld"],
    [120, "death", "Noobik", "Noobik bol zabitý zombie", 22, 63, -6, "minecraft:overworld"],
    [110, "chat", "Majka", "nechaj mi aspoň stack železa v truhlici pri spawne", 12, 64, 80, "minecraft:overworld"],
    [96, "command", "Majka", "/sethome farma", 18, 64, 90, "minecraft:overworld"],
    [80, "join", "Majka", "Majka sa pripojila", 12.4, 64, 88.1, "minecraft:overworld"],
    [70, "action", "Pixel", "Broadcast: Záloha sveta o 22:00", 0.5, 80, 0.5, "minecraft:overworld"],
    [55, "chat", "Banik_Jozef", "v netheri je pevnosť kúsok od portálu, bez armoru tam nechoďte", 200, 67, -30, "minecraft:the_nether"],
    [48, "command", "Banik_Jozef", "/sethome nether", 210, 68, -40, "minecraft:the_nether"],
    [40, "leave", "Noobik", "Noobik sa odpojil", 20, 70, -10, "minecraft:overworld"],
    [36, "death", "Banik_Jozef", "Banik_Jozef zhoril v láve", 214, 54, -44, "minecraft:the_nether"],
    [28, "chat", "EnderLisa", "drak je dole, mesto v ende je voľné", 8.5, 64, 22, "minecraft:the_end"],
    [22, "command", "Kubko", "/home", 180, 71, -400, "minecraft:overworld"],
    [16, "chat", "Dusanek", "pomoc, spadol som do jamy, nemám jedlo", -340.2, 12, 64.8, "minecraft:overworld"],
    [12, "action", "Pixel", "Vyčistené dropnuté predmety pri farme", 30, 64, 40, "minecraft:overworld"],
    [8, "chat", "Pixel", "pred hodinou TPS spadlo pod 15, už je to späť na 20", 0.5, 80, 0.5, "minecraft:overworld"],
    [5, "command", "Pixel", "/tp Dusanek", 0.5, 80, 0.5, "minecraft:overworld"],
    [2, "chat", "Majka", "idem spať, nenechávajte pec bez dozoru", 12.4, 64, 88.1, "minecraft:overworld"],
  ];

  const auditLogs: AuditRecord[] = script.map((row, index) => ({
    id: `aud_${index}`,
    serverId: SERVER,
    type: row[1],
    player: row[2],
    message: row[3],
    x: row[4],
    y: row[5],
    z: row[6],
    dimension: row[7],
    timestamp: iso(now - row[0] * 60 * 1000),
  }));

  const server: ServerRecord = {
    id: SERVER,
    name: "Hory a Doly",
    apiKey: DEMO_API_KEY,
    ownerId: DEMO_OWNER_ID,
    motd: "Slovenský survival · bez pay-to-win",
    version: "1.20.1",
    maxPlayers: 40,
    stopped: false,
    createdAt: iso(now - 40 * 24 * 60 * 60 * 1000),
  };

  const commands: CommandRecord[] = [
    {
      id: "cmd_seed_broadcast",
      serverId: SERVER,
      action: "broadcast",
      args: { title: "Záloha sveta o 22:00", subtitle: "Počítajte s krátkym reštartom" },
      status: "completed",
      result: "Dokončené v ukážkových dátach",
      createdAt: iso(now - 70 * 60 * 1000),
      updatedAt: iso(now - 69 * 60 * 1000),
    },
  ];

  return {
    users: [
      {
        id: DEMO_OWNER_ID,
        name: "Demo Majiteľ",
        email: "majitel@craftops.local",
        discordId: null,
      },
    ],
    servers: [server],
    telemetry,
    auditLogs,
    players,
    commands,
  };
}

function player(
  id: string,
  uuid: string,
  username: string,
  ping: number,
  dimension: string,
  x: number,
  y: number,
  z: number,
  health: number,
  food: number,
  operator: boolean,
  online: boolean,
  joinedMin: number,
  leftMin: number | null,
  now: number,
): PlayerRecord {
  return {
    id,
    serverId: SERVER,
    uuid,
    username,
    ping,
    dimension,
    x,
    y,
    z,
    health,
    food,
    operator,
    online,
    joinedAt: iso(now - joinedMin * 60 * 1000),
    leftAt: leftMin == null ? null : iso(now - leftMin * 60 * 1000),
  };
}
