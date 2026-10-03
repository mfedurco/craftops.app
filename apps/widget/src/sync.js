/**
 * Minute sync stub.
 *
 * Production: a Cloudflare cron reads CraftOps GET /api/v1/badge?server=
 * and writes JSON into the STATUS KV binding. This file is that job without
 * a real KV namespace. When CRAFTOPS_API is unset it does nothing and the
 * read path keeps serving mock-kv.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const kvPath = path.join(root, "mock-kv.json");

export async function syncOnce({ apiBase, serverId, file = kvPath } = {}) {
  if (!apiBase) {
    return { synced: false, reason: "CRAFTOPS_API is not set; serving mock KV only." };
  }
  const response = await fetch(`${apiBase.replace(/\/$/, "")}/api/v1/badge?server=${encodeURIComponent(serverId)}`);
  if (!response.ok) {
    throw new Error(`badge api ${response.status}`);
  }
  const json = await response.json();
  const current = JSON.parse(fs.readFileSync(file, "utf8"));
  current[serverId] = json;
  fs.writeFileSync(file, JSON.stringify(current, null, 2) + "\n");
  return { synced: true, serverId };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apiBase = process.env.CRAFTOPS_API || "";
  const serverId = process.env.CRAFTOPS_SERVER || "srv_hory_a_doly";
  syncOnce({ apiBase, serverId })
    .then((result) => {
      console.log(result);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
