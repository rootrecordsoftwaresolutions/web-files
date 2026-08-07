/** Account shard — app session Discord notify + portal auth (see `rootrecord-api-account`). */
export const ROOTRECORD_ACCOUNT_API_ORIGIN =
  "https://rootrecord-api-account.rootrecord.workers.dev";

export { notifyAppSessionStart, resolveAccountNotifyOrigin } from "./notifyAppSessionStart.js";
