import fs from "node:fs";
import crypto from "node:crypto";

function must(condition, message) {
  if (!condition) throw new Error(message);
}

const required = [
  "desktop/cs2haze/launcher/CS2Haze.Launcher.csproj",
  "desktop/cs2haze/launcher/Program.cs",
  "desktop/cs2haze/launcher/MainForm.cs",
  "desktop/cs2haze/updater/CS2Haze.Updater.csproj",
  "desktop/cs2haze/installer/cs2haze.iss",
  "desktop/cs2haze/scripts/build-cs2haze.ps1",
  ".github/workflows/build-cs2haze.yml",
];

for (const path of required) {
  must(fs.existsSync(path), `Missing: ${path}`);
}

const agent = fs.readFileSync("scripts/cs2-agent.js", "utf8");
const publicAgent = fs.readFileSync("public/cs2-agent.js", "utf8");
const overlay = fs.readFileSync("public/overlays/cs2.html", "utf8");
const generated = fs.readFileSync("src/generated/cs2-agent-source.ts", "utf8");

must(agent.includes('const AGENT_VERSION = "2.0.6";'), "Working agent version changed");
must(agent === publicAgent, "Working agent/public copy differ");
must(!agent.includes("cs2haze"), "Launcher changes leaked into working agent");
must(!overlay.includes("cs2haze"), "Launcher changes leaked into OBS overlay");

const launcher = fs.readFileSync(
  "desktop/cs2haze/launcher/MainForm.cs",
  "utf8"
);
must(launcher.includes("Проверка обновлений"), "Mandatory update startup missing");
must(launcher.includes("LoginThroughExistingWebsiteAsync"), "Website login flow missing");
must(launcher.includes("RequireSubscription"), "Subscription gate scaffold missing");

const installer = fs.readFileSync(
  "desktop/cs2haze/installer/cs2haze.iss",
  "utf8"
);
must(installer.includes('OutputBaseFilename=CS2Haze-Setup'), "Installer name wrong");
must(installer.includes('Name: "{autodesktop}\\cs2haze"'), "Desktop shortcut wrong");

console.log("cs2haze integration verification passed.");
