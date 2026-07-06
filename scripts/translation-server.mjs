#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const tsDir = join(here, "..", ".translation-server");
const entry = join(tsDir, "src", "server.js");
const translatorsDir = join(tsDir, "modules", "translators");
const nodeConfigPkg = join(tsDir, "node_modules", "config");

function fail(message) {
  console.error(`[translation-server] ${message}`);
  process.exit(1);
}

if (!existsSync(entry)) {
  fail(
    "Not found at .translation-server/. Clone it once (gitignored):\n" +
      "  git clone --recurse-submodules https://github.com/zotero/translation-server .translation-server\n" +
      "  cd .translation-server && npm install\n" +
      "See backend/.env.example (TRANSLATION_SERVER_URL section)."
  );
}
if (!existsSync(nodeConfigPkg)) {
  fail(
    "Dependencies not installed. Run once:\n" +
      "  cd .translation-server && npm install"
  );
}
if (!existsSync(translatorsDir)) {
  fail(
    "Submodule modules/translators is missing — the server would load 0 translators.\n" +
      "Run inside .translation-server:\n" +
      "  git submodule update --init --recursive"
  );
}

console.log(`[translation-server] starting from ${tsDir} (port 1969)…`);

const child = spawn(process.execPath, [entry], { cwd: tsDir, stdio: "inherit" });

child.on("error", (err) => fail(`failed to spawn: ${err.message}`));
child.on("exit", (code) => process.exit(code ?? 0));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
