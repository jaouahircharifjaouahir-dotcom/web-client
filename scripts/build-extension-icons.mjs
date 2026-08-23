#!/usr/bin/env node
/** Generate crisp, optimized 16/32/48/128 PNG icons from the 11tik SVG brand mark. */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ICONS = join(ROOT, "extensions", "11tik-youtube-thumbnail", "icons");
const ASSETS = join(ROOT, "assets");

execFileSync(
  "powershell",
  [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    join(ROOT, "scripts", "build-extension-icons.ps1"),
    "-IconsDir",
    ICONS,
    "-AssetsDir",
    ASSETS,
  ],
  { stdio: "inherit" },
);

console.log("Extension icons generated in", ICONS);
