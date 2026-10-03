export type ParsedCommand = {
  action: string;
  args: Record<string, string>;
};

const ACTIONS = new Set([
  "stop",
  "kick",
  "ban",
  "teleport",
  "give",
  "broadcast",
  "heal",
  "op",
  "deop",
  "clear_drops",
  "rcon",
]);

export function parseConsoleLine(line: string): ParsedCommand {
  const trimmed = line.trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const head = (parts[0] ?? "").replace(/^\//, "").toLowerCase();
  switch (head) {
    case "stop":
      return { action: "stop", args: {} };
    case "kick":
      return {
        action: "kick",
        args: { player: parts[1] ?? "", reason: parts.slice(2).join(" ") || "Kick z konzoly" },
      };
    case "ban":
      return {
        action: "ban",
        args: { player: parts[1] ?? "", reason: parts.slice(2).join(" ") || "Ban z konzoly" },
      };
    case "tempban":
      return {
        action: "ban",
        args: {
          player: parts[1] ?? "",
          durationSeconds: parts[2] ?? "3600",
          reason: parts.slice(3).join(" ") || "Dočasný ban z konzoly",
        },
      };
    case "tp":
    case "teleport":
      if (!parts[2] || parts[2] === "spawn") {
        return { action: "teleport", args: { player: parts[1] ?? "", spawn: "true" } };
      }
      return {
        action: "teleport",
        args: {
          player: parts[1] ?? "",
          x: parts[2] ?? "",
          y: parts[3] ?? "",
          z: parts[4] ?? "",
          dimension: parts[5] ?? "",
          spawn: "false",
        },
      };
    case "give":
      return {
        action: "give",
        args: {
          player: parts[1] ?? "",
          item: parts[2] ?? "minecraft:diamond",
          count: parts[3] ?? "1",
        },
      };
    case "heal":
      return { action: "heal", args: { player: parts[1] ?? "" } };
    case "op":
      return { action: "op", args: { player: parts[1] ?? "" } };
    case "deop":
      return { action: "deop", args: { player: parts[1] ?? "" } };
    case "clear":
    case "cleardrops":
      return { action: "clear_drops", args: {} };
    case "say":
    case "broadcast":
      return { action: "broadcast", args: { title: parts.slice(1).join(" "), subtitle: "" } };
    case "title": {
      const rest = parts.slice(1).join(" ");
      const [title, subtitle = ""] = rest.split("|");
      return { action: "broadcast", args: { title: title.trim(), subtitle: subtitle.trim() } };
    }
    default:
      return { action: "rcon", args: { command: trimmed.replace(/^\//, "") } };
  }
}

export function isKnownAction(action: string) {
  return ACTIONS.has(action);
}

export function stringArgs(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value == null) continue;
    out[key] = String(value);
  }
  return out;
}
