#!/usr/bin/env node
/**
 * Launch the cloned Zotero translation-server from ITS OWN directory.
 *
 * The Zotero server uses `node-config`, which resolves `./config` relative to
 * `process.cwd()`; it also reads `translatorsDirectory: "./modules/translators"`
 * (also cwd-relative). The npm script runs from `backend/`, so running
 * `node .translation-server/src/server.js` directly makes node-config look for
 * `backend/config` (absent) and crash with
 *   Error: Configuration property "trustProxyHeaders" is not defined
 * before the server ever listens. This launcher spawns server.js with cwd set to
 * the clone root so config + translators resolve correctly.
 *
 * See .kiro/specs/zotero-translation-server-autostart-fix/.
 */
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url)); // backend/scripts
const tsDir = join(here, "..", ".translation-server"); // backend/.translation-server
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

// Forward termination so the server doesn't linger on port 1969 after Ctrl+C.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
