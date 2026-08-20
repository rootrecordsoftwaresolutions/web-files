/**
 * Dynamic /data/{scope}/{dataset}/ and /data/servers/{uuid}/… shells.
 * Cloudflare Pages _redirects placeholders/splats were not rewriting these
 * (fell through to the site homepage). Static catalogs stay on disk.
 */
type PagesContext = {
  request: Request;
  next: () => Promise<Response>;
  env: { ASSETS: { fetch: (input: Request | string) => Promise<Response> } };
  params: { path?: string | string[] };
};

const SCOPES = new Set(["towny", "claims", "official", "servers"]);
const DATASETS = new Set([
  "balances",
  "playtime",
  "gold_found",
  "shops",
  "times",
  "online",
  "sync",
]);

function partsFrom(path: string | string[] | undefined): string[] {
  if (path == null) return [];
  if (Array.isArray(path)) return path.map(String).filter(Boolean);
  return String(path)
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
}

async function serveAsset(
  env: PagesContext["env"],
  request: Request,
  assetPath: string,
): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = assetPath;
  const res = await env.ASSETS.fetch(url.toString());
  if (!res.ok) {
    return new Response(`Missing asset ${assetPath}`, { status: 500 });
  }
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "public, max-age=60");
  return new Response(res.body, { status: 200, headers });
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const parts = partsFrom(context.params.path);

  // /data or /data/ — static
  if (parts.length === 0) {
    return context.next();
  }

  const scope = parts[0] || "";
  if (!SCOPES.has(scope)) {
    return context.next();
  }

  // /data/towny/ · /data/claims/ · /data/official/ · /data/servers/ — static catalogs
  if (parts.length === 1) {
    return context.next();
  }

  // /data/servers/{uuid}/ — host catalog shell
  if (scope === "servers" && parts.length === 2) {
    return serveAsset(context.env, context.request, "/data/servers/host/index.html");
  }

  // /data/servers/{uuid}/{dataset}/
  if (scope === "servers" && parts.length >= 3) {
    const dataset = parts[2] || "";
    if (!DATASETS.has(dataset)) {
      return context.next();
    }
    return serveAsset(context.env, context.request, "/data/dataset/index.html");
  }

  // /data/{towny|claims|official}/{dataset}/
  if (parts.length >= 2) {
    const dataset = parts[1] || "";
    if (!DATASETS.has(dataset)) {
      return context.next();
    }
    return serveAsset(context.env, context.request, "/data/dataset/index.html");
  }

  return context.next();
};
