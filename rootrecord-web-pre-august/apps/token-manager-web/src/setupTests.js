// Jest + @solana/web3.js: match browser globals web3 expects in the test runner.
const { TextEncoder, TextDecoder } = require("util");
const nodeCrypto = require("crypto");

if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  globalThis.TextDecoder = TextDecoder;
}
if (!globalThis.crypto?.getRandomValues) {
  globalThis.crypto =
    nodeCrypto.webcrypto ||
    { getRandomValues: (b) => nodeCrypto.randomFillSync(b) };
}
