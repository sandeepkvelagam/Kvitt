/**
 * Expo CLI nests @expo/cli under expo; patch-package does not pick up those diffs.
 * Increases ngrok tunnel wait from 10s default to 60s (or EXPO_TUNNEL_TIMEOUT_MS).
 */
const fs = require("fs");
const path = require("path");

const candidates = [
  path.join(__dirname, "../node_modules/expo/node_modules/@expo/cli/build/src/start/server/AsyncNgrok.js"),
  path.join(__dirname, "../node_modules/@expo/cli/build/src/start/server/AsyncNgrok.js"),
];

const OLD = "const TUNNEL_TIMEOUT = 10 * 1000;";
const NEW = `/** Default 60s — slow/campus networks; override with EXPO_TUNNEL_TIMEOUT_MS. */
const TUNNEL_TIMEOUT = (() => {
    const ms = parseInt(process.env.EXPO_TUNNEL_TIMEOUT_MS || "", 10);
    return Number.isFinite(ms) && ms > 0 ? ms : 60 * 1000;
})();`;

let file = candidates.find((p) => fs.existsSync(p));
if (!file) {
  console.warn("[patch-expo-cli-tunnel-timeout] AsyncNgrok.js not found (skip).");
  process.exit(0);
}

let src = fs.readFileSync(file, "utf8");
if (src.includes("EXPO_TUNNEL_TIMEOUT_MS")) {
  process.exit(0);
}
if (!src.includes(OLD)) {
  console.warn("[patch-expo-cli-tunnel-timeout] Unexpected AsyncNgrok.js contents (skip).");
  process.exit(0);
}

fs.writeFileSync(file, src.replace(OLD, NEW), "utf8");
console.log("[patch-expo-cli-tunnel-timeout] Patched %s", path.relative(path.join(__dirname, ".."), file));
