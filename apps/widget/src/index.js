import { renderHtml, renderSvg } from "./badge.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const server = url.searchParams.get("server") || "srv_hory_a_doly";
    let status = null;
    if (env.STATUS) {
      status = await env.STATUS.get(server, "json");
    }
    if (!status) {
      status = { id: server, name: server, online: false, players: 0, max: 0, tps: 0, mspt: 0 };
    } else {
      status = { id: server, ...status };
    }
    if (url.pathname === "/badge.svg" || url.pathname.endsWith(".svg")) {
      return new Response(renderSvg(status), {
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          "cache-control": "public, max-age=60",
        },
      });
    }
    return new Response(renderHtml(status, url.origin), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
};
