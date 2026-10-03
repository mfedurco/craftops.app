import type { AuditRecord, AuditType, DashboardData, SeriesPoint, ServerRecord, TelemetryPoint } from "./types";

const DAY = 24 * 60 * 60 * 1000;

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function formatUptime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("sk-SK", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function dimensionLabel(id: string | null | undefined) {
  if (!id) return "—";
  if (id.endsWith("the_nether")) return "Nether";
  if (id.endsWith("the_end")) return "End";
  if (id.endsWith("overworld")) return "Overworld";
  return id.replace("minecraft:", "");
}

export function formatCoords(x: number | null, y: number | null, z: number | null) {
  if (x == null || y == null || z == null) return "—";
  const n = (value: number) => value.toFixed(1);
  return `${n(x)} ${n(y)} ${n(z)}`;
}

export function auditLabel(type: string) {
  const labels: Record<string, string> = {
    chat: "Chat",
    command: "Príkaz",
    join: "Pripojenie",
    leave: "Odpojenie",
    death: "Smrť",
    action: "Akcia",
  };
  return labels[type] ?? type;
}

export function commandStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Čaká na mod",
    delivered: "Odoslané modu",
    completed: "Hotovo",
    failed: "Zlyhalo",
  };
  return labels[status] ?? status;
}

export function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function craftOpsJson(apiKey: string, endpoint = "http://127.0.0.1:38471/api/v1") {
  return `${JSON.stringify(
    {
      api_key: apiKey,
      endpoint,
      telemetry_interval_seconds: 10,
    },
    null,
    2,
  )}\n`;
}

export function buildDashboard(
  server: ServerRecord,
  telemetry: TelemetryPoint[],
  onlineCount: number,
  recent: AuditRecord[],
  now = Date.now(),
): DashboardData {
  const sorted = [...telemetry].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const day = sorted.filter((point) => now - Date.parse(point.timestamp) <= DAY);
  const week = sorted.filter((point) => now - Date.parse(point.timestamp) <= 7 * DAY);
  const latest = sorted[sorted.length - 1];
  const avgMspt = day.length ? day.reduce((sum, point) => sum + point.mspt, 0) / day.length : 0;
  const healthy = day.filter((point) => point.tps >= 18).length;
  return {
    server,
    kpis: {
      uptimeRatio: day.length ? healthy / day.length : 1,
      uptimeLabel: formatUptime(latest?.uptimeSeconds ?? 0),
      playersOnline: server.stopped ? 0 : onlineCount,
      maxPlayers: server.maxPlayers,
      avgMspt: round1(avgMspt),
      tps: round1(latest?.tps ?? 0),
      mspt: round1(latest?.mspt ?? 0),
      ramUsedMb: Math.round(latest?.ramUsedMb ?? 0),
    },
    series: {
      h24: downsample(day, 96, false),
      d7: downsample(week, 84, true),
    },
    recent,
  };
}

function downsample(points: TelemetryPoint[], buckets: number, withDay: boolean): SeriesPoint[] {
  if (points.length === 0) return [];
  const size = Math.max(1, Math.ceil(points.length / buckets));
  const out: SeriesPoint[] = [];
  for (let index = 0; index < points.length; index += size) {
    const slice = points.slice(index, index + size);
    const last = slice[slice.length - 1];
    const avg = (key: "tps" | "mspt" | "ramUsedMb") => slice.reduce((sum, point) => sum + point[key], 0) / slice.length;
    const date = new Date(last.timestamp);
    out.push({
      t: last.timestamp,
      label: withDay
        ? date.toLocaleString("sk-SK", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })
        : date.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }),
      tps: round1(avg("tps")),
      mspt: round1(avg("mspt")),
      ram: Math.round(avg("ramUsedMb")),
    });
  }
  return out;
}

export function isAuditType(value: string): value is AuditType {
  return ["chat", "command", "join", "leave", "death", "action"].includes(value);
}
