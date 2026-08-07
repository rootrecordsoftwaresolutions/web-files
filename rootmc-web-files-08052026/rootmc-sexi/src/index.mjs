import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function run(script) {
  const child = spawn(process.execPath, [path.join(__dirname, script)], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => {
    console.error(`${script} exited`, code);
    process.exit(code || 1);
  });
  return child;
}

run("server.mjs");
run("poller.mjs");
