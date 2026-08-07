/**
 * Same-origin proxy: /api/* on goals Pages → Root Goals API Worker.
 * Avoids cross-origin blocks (e.g. Brave Shields) against api-goals.rootrecord.info.
 */
import { goalsApiBaseFromEnv } from "../_lib/goalsApiBase";

type Env = {
  ROOTRECORD_API_GOALS_BASE?: string;
};

function tailFromParams(path: string | string[] | undefined): string {
  if (path === undefined) return "";
  return Array.isArray(path) ? path.join("/") : String(path);
}

export const onRequest = async (context: {
  request: Request;
  env: Env;
  params: Record<string, string | string[] | undefined>;
}): Promise<Response> => {
  const base = goalsApiBaseFromEnv(context.env);
  const tail = tailFromParams(context.params.path);
  const url = new URL(context.request.url);
  const upstreamPath = tail ? `/api/${tail}` : "/api";
  const target = `${base}${upstreamPath}${url.search}`;

  const incoming = context.request;
  const headers = new Headers(incoming.headers);
  headers.delete("Host");

  const method = incoming.method;
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  const bodyBuf = hasBody ? await incoming.arrayBuffer() : null;

  try {
    return await fetch(target, {
      method,
      headers,
      body: hasBody ? bodyBuf : undefined,
      redirect: "manual",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ detail: `Upstream fetch failed: ${msg}` }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
};
