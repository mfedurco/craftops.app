import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderHtml, renderSvg } from "./src/badge.js";
import { syncOnce } from "./src/sync.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const kvPath = path.join(root, "mock-kv.json");
const port = Number(process.env.PORT || 38472);
const apiBase = process.env.CRAFTOPS_API || "";

function readKv() {
  return JSON.parse(fs.readFileSync(kvPath, "utf8"));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  const id = url.searchParams.get("server") || "srv_hory_a_doly";
  const kv = readKv();
  const status = { id, ...(kv[id] || { name: id, online: false, players: 0, max: 0, tps: 0, mspt: 0 }) };
  if (url.pathname === "/badge.svg") {
    res.writeHead(200, { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=30" });
    res.end(renderSvg(status));
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(renderHtml(status, `http://127.0.0.1:${port}`));
});

server.listen(port, "0.0.0.0", () => {
  console.log(`CraftOps widget mock http://127.0.0.1:${port}/badge.svg?server=srv_hory_a_doly`);
});

if (apiBase) {
  const serverId = process.env.CRAFTOPS_SERVER || "srv_hory_a_doly";
  const run = () => syncOnce({ apiBase, serverId, file: kvPath }).catch((error) => console.error(error.message));
  void run();
  setInterval(run, 60_000);
}
