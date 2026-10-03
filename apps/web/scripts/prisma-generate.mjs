import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env = { ...process.env };
if (!env.DATABASE_URL) {
  env.DATABASE_URL = "postgresql://craftops:craftops@127.0.0.1:5432/craftops?schema=public";
}

const bin = path.join(root, "node_modules", ".bin", "prisma");
const result = spawnSync(bin, ["generate"], {
  cwd: root,
  env,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
