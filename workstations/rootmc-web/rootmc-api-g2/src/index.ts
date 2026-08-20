import type { ExecutionContext } from "@cloudflare/workers-types";

import realmWorker from "../../rootmc-realm-api/src/realm-index";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return realmWorker.fetch(request, env, ctx);
  },
};

export type { Env } from "../../rootmc-realm-api/src/realm-router";
