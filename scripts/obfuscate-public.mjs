import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import JavaScriptObfuscator from "javascript-obfuscator";

const root = resolve(import.meta.dirname, "..");
const files = ["blogger-app.js", "rights-boot.js", "ga-boot.js", "site-header.js"];

const shared = {
  compact: true,
  target: "browser",
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  reservedNames: ["^gtag$", "^dataLayer$", "^YTE$", "^__yte"],
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  unicodeEscapeSequence: false,
  sourceMap: false,
};

const heavy = {
  ...shared,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayEncoding: ["base64"],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.85,
  splitStrings: true,
  splitStringsChunkLength: 8,
};

const light = {
  ...shared,
  stringArray: true,
  stringArrayEncoding: ["base64"],
  stringArrayThreshold: 0.4,
  splitStrings: false,
};

for (const name of files) {
  const path = resolve(root, "dist", name);
  if (!existsSync(path)) continue;
  const source = readFileSync(path, "utf8").replace(/\n\/\/# sourceMappingURL=.*$/m, "\n");
  const options = name === "blogger-app.js" || name === "site-header.js" ? light : heavy;
  const result = JavaScriptObfuscator.obfuscate(source, options).getObfuscatedCode();
  const footer = name === "blogger-app.js" ? "\n//# sourceMappingURL=blogger-app.js.map\n" : "\n";
  writeFileSync(path, `${result}${footer}`);
}
