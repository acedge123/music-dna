import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
const walk = (dir) =>
  readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(`${dir}/${e.name}`)
      : e.name.endsWith(".ts") && !e.name.includes(".test.")
        ? [`${dir}/${e.name}`]
        : [],
  );
const files = [
  "src/lib/musicdna.functions.ts",
  "src/musicdna/learning/pilot-routing.ts",
  ...walk("src/musicdna/engine"),
  ...walk("src/musicdna/router"),
].sort();
const hash = createHash("sha256");
for (const file of files)
  hash
    .update(file + "\0")
    .update(readFileSync(new URL(file, root)))
    .update("\0");
const expected = { policy_id: "musicdna-selector", version: "sha256:" + hash.digest("hex"), files };
const target = new URL("src/musicdna/learning/routing-artifact.json", root);
if (process.argv.includes("--write"))
  writeFileSync(target, JSON.stringify(expected, null, 2) + "\n");
else if (JSON.stringify(JSON.parse(readFileSync(target, "utf8"))) !== JSON.stringify(expected)) {
  throw new Error(
    "Routing sources changed: review attribution and run node scripts/check-routing-artifact.mjs --write",
  );
} else console.log("Routing source artifact verified");
