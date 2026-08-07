/** Must be imported before `@solana/web3.js` — `bigint-buffer` logs when native .node is missing (e.g. pkg .exe). */
const origWarn = console.warn.bind(console);
const origErr = console.error.bind(console);
function isBigintBufferNoise(s) {
  return typeof s === "string" && s.includes("bigint:") && s.includes("Failed to load bindings");
}
console.warn = (...args) => {
  if (args.length && isBigintBufferNoise(String(args[0]))) return;
  origWarn(...args);
};
console.error = (...args) => {
  if (args.length && isBigintBufferNoise(String(args[0]))) return;
  origErr(...args);
};
