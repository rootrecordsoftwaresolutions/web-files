import {
  accountApiBaseFromEnv,
  rootmcApiBaseFromEnv,
  isAccountShardApiTail,
  isRootMcShardApiTail,
  rewriteLegacyBlocknotesApiTail,
} from "../_lib/accountApiBase";

type Env = {
  ROOTMC_API_BASE?: string;
  ROOTRECORD_API_ACCOUNT_BASE?: string;
  ROOTRECORD_API_BLOCKNOTES_BASE?: string;
};

function tailFromParams(path: string | string[] | undefined): string {
  if (path === undefined) return "";
  return Array.isArray(path) ? path.join("/") : String(path);
}

/** rootmc.net/api/* → api.rootmc.net or account worker. */
export const onRequest = async (context: {
  request: Request;
  env: Env;
  params: Record<string, string | string[] | undefined>;
}): Promise<Response> => {
  const tail = rewriteLegacyBlocknotesApiTail(tailFromParams(context.params.path));
  const useRootMc = isRootMcShardApiTail(tail);
  const useAccount = !useRootMc && isAccountShardApiTail(tail);
  const base = useRootMc
    ? rootmcApiBaseFromEnv(context.env)
    : useAccount
      ? accountApiBaseFromEnv(context.env)
      : rootmcApiBaseFromEnv(context.env);
  const url = new URL(context.request.url);
  const upstreamPath = tail ? `/api/${tail}` : "/api";
  const target = `${base}${upstreamPath}${url.search}`;

  const incoming = context.request;
  const headers = new Headers(incoming.headers);
  headers.delete("Host");
  headers.delete("CF-Connecting-IP");

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
