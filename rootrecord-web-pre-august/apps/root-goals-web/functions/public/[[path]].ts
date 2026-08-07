/**
 * GET /public/* — same-origin proxy for shared public goal pages.
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
  if (context.request.method !== "GET" && context.request.method !== "HEAD" && context.request.method !== "OPTIONS") {
    return new Response(JSON.stringify({ detail: "Method not allowed" }), { status: 405 });
  }
  const base = goalsApiBaseFromEnv(context.env);
  const tail = tailFromParams(context.params.path);
  const incoming = new URL(context.request.url);
  const upstream = new URL(`${base}/public/${tail}`);
  incoming.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

  try {
    return await fetch(upstream.toString(), {
      method: context.request.method,
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ detail: `Upstream fetch failed: ${msg}` }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
};
