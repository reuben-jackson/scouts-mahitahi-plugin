// Usage: npm run bump -- <major|minor|patch>
// Updates package.json and adds an empty entry to CHANGELOG.md for you to fill in.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const kind = process.argv[2];
if (!["major", "minor", "patch"].includes(kind)) {
    console.error("Usage: npm run bump -- <major|minor|patch>");
    process.exit(1);
}

const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
let [major, minor, patch] = pkg.version.split(".").map(Number);
if (kind === "major") { major++; minor = 0; patch = 0; }
else if (kind === "minor") { minor++; patch = 0; }
else { patch++; }
pkg.version = `${major}.${minor}.${patch}`;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const logPath = join(root, "CHANGELOG.md");
const log = readFileSync(logPath, "utf8");
const entry = `## ${pkg.version} - ${new Date().toISOString().slice(0, 10)}\n\n- TODO: describe the change\n\n`;
writeFileSync(logPath, log.replace(/(?=^## )/m, entry));
console.log(`Version is now ${pkg.version}. Edit CHANGELOG.md, then run: npm run package`);
