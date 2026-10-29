import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = process.env.PORT ?? "3000";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}
const child = spawn(process.execPath, [
  fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)),
  "start", "--hostname", "0.0.0.0", "--port", port,
], { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
