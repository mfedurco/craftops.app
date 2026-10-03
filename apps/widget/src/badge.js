export function renderSvg(status) {
  const online = Boolean(status?.online);
  const name = escapeXml(status?.name || "CraftOps");
  const players = Number(status?.players ?? 0);
  const max = Number(status?.max ?? 0);
  const tps = Number(status?.tps ?? 0).toFixed(1);
  const dot = online ? "#8fbf7f" : "#e07a5f";
  const label = online ? "online" : "offline";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="280" height="36" viewBox="0 0 280 36" role="img" aria-label="${name} ${label}">
  <rect width="280" height="36" rx="6" fill="#14110e" stroke="#3a322a"/>
  <circle cx="16" cy="18" r="4" fill="${dot}"/>
  <text x="28" y="22" fill="#f3eadf" font-family="ui-sans-serif,system-ui,sans-serif" font-size="13">${name}</text>
  <text x="268" y="22" fill="#e0a15a" font-family="ui-monospace,monospace" font-size="12" text-anchor="end">${players}/${max} · TPS ${tps}</text>
</svg>`;
}

export function renderHtml(status, origin) {
  const server = status?.id || "demo";
  const src = `${origin}/badge.svg?server=${encodeURIComponent(server)}`;
  return `<!doctype html>
<html lang="sk">
<meta charset="utf-8">
<title>CraftOps badge</title>
<body style="margin:0;background:#100e0c;color:#f3eadf;font-family:ui-sans-serif,system-ui,sans-serif">
  <main style="max-width:40rem;margin:2rem auto;padding:0 1rem">
    <h1 style="font-size:1.1rem">CraftOps status badge</h1>
    <p>Vložte odznak na fórum. Dáta číta KV cache, nie živú databázu.</p>
    <p><img alt="status" src="${src}"></p>
    <pre style="overflow:auto;background:#14110e;padding:1rem;border:1px solid #3a322a">&lt;img src="${src}" alt="CraftOps"&gt;</pre>
  </main>
</body>
</html>`;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[char]);
}
