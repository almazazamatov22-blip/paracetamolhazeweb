import fs from "node:fs/promises";
import path from "node:path";

const assetsDir = path.resolve(".open-next", "assets");
const ignorePath = path.join(assetsDir, ".assetsignore");
const ignoredEntries = [
  "dist/launcher.exe",
];

async function main() {
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(ignorePath, `${ignoredEntries.join("\n")}\n`, "utf8");
  console.log(`[cf-prepare-assets] wrote ${ignorePath}`);
}

main().catch((error) => {
  console.error("[cf-prepare-assets] failed:", error);
  process.exit(1);
});
