/**
 * Expo CLI nests @expo/cli under expo; patch-package does not pick up those diffs.
 * Allows EXPO_NGROK_AUTHTOKEN (e.g. from .env) so tunnel works when Expo's shared ngrok
 * token hits limits (ERR_NGROK_108) or auth fails — see https://dashboard.ngrok.com/get-started/your-authtoken
 */
const fs = require("fs");
const path = require("path");

const candidates = [
  path.join(__dirname, "../node_modules/expo/node_modules/@expo/cli/build/src/start/server/AsyncNgrok.js"),
  path.join(__dirname, "../node_modules/@expo/cli/build/src/start/server/AsyncNgrok.js"),
];

const OLD = `const NGROK_CONFIG = {
    authToken: '5W1bR67GNbWcXqmxZzBG1_56GezNeaX6sSRvn8npeQ8',
    domain: 'exp.direct'
};`;

const NEW = `const NGROK_CONFIG = {
    authToken: process.env.EXPO_NGROK_AUTHTOKEN || '5W1bR67GNbWcXqmxZzBG1_56GezNeaX6sSRvn8npeQ8',
    domain: 'exp.direct'
};`;

let file = candidates.find((p) => fs.existsSync(p));
if (!file) {
  console.warn("[patch-expo-cli-ngrok-authtoken] AsyncNgrok.js not found (skip).");
  process.exit(0);
}

let src = fs.readFileSync(file, "utf8");
if (src.includes("process.env.EXPO_NGROK_AUTHTOKEN")) {
  process.exit(0);
}
if (!src.includes(OLD)) {
  console.warn("[patch-expo-cli-ngrok-authtoken] Unexpected AsyncNgrok.js contents (skip).");
  process.exit(0);
}

fs.writeFileSync(file, src.replace(OLD, NEW), "utf8");
console.log("[patch-expo-cli-ngrok-authtoken] Patched %s", path.relative(path.join(__dirname, ".."), file));
