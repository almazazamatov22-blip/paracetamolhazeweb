import fs from "node:fs";
import { spawnSync } from "node:child_process";

function must(condition, message) {
  if (!condition) throw new Error(message);
}

const required = [
  "desktop/cs2haze/launcher/CS2Haze.Launcher.csproj",
  "desktop/cs2haze/launcher/launcher-config.json",
  "desktop/cs2haze/launcher/Program.cs",
  "desktop/cs2haze/launcher/Services/PendingConnectTokenStore.cs",
  "desktop/cs2haze/launcher/MainForm.cs",
  "desktop/cs2haze/tests/CS2Haze.TokenStoreSmoke.csproj",
  "desktop/cs2haze/tests/CS2Haze.UpdateSmoke.csproj",
  "desktop/cs2haze/tests/Program.cs",
  "desktop/cs2haze/tests/UpdateSmokeProgram.cs",
  "desktop/cs2haze/updater/CS2Haze.Updater.csproj",
  "desktop/cs2haze/updater/UpdateInstaller.cs",
  "desktop/cs2haze/installer/cs2haze.iss",
  "desktop/cs2haze/scripts/build-cs2haze.ps1",
  ".github/workflows/build-cs2haze.yml",
];

for (const path of required) {
  must(fs.existsSync(path), `Missing: ${path}`);
}

for (const routePath of [
  "src/app/api/cs2/download/route.ts",
  "src/app/api/cs2/agent/download/route.ts",
]) {
  const ignored = spawnSync(
    "git",
    [
      "-c",
      "core.excludesFile=.vercelignore",
      "check-ignore",
      "--no-index",
      "-q",
      routePath,
    ],
    { encoding: "utf8" }
  );
  must(ignored.status === 1, `Vercel excludes API route: ${routePath}`);
}

const launcherConfig = JSON.parse(
  fs.readFileSync("desktop/cs2haze/launcher/launcher-config.json", "utf8")
);
must(
  launcherConfig.AgentBaseUrl === launcherConfig.ApiBaseUrl,
  `Launcher agent origin diverges from the working API origin: ${launcherConfig.AgentBaseUrl}`
);

const launcherProgram = fs.readFileSync(
  "desktop/cs2haze/launcher/Program.cs",
  "utf8"
);
const authService = fs.readFileSync(
  "desktop/cs2haze/launcher/Services/AuthService.cs",
  "utf8"
);
const tokenStore = fs.readFileSync(
  "desktop/cs2haze/launcher/Services/PendingConnectTokenStore.cs",
  "utf8"
);
must(
  launcherProgram.includes("new PendingConnectTokenStore().Write(connectToken)"),
  "Protocol callback does not use the shared token store"
);
must(
  tokenStore.includes('$@"Global\\cs2haze-connect-token-{CurrentUserSid}"'),
  "Protocol token store does not synchronize launcher processes"
);
must(
  tokenStore.includes('$@"Global\\cs2haze-launcher-{CurrentUserSid}"'),
  "Single-instance mutex does not span Windows sessions for the current user"
);
must(
  tokenStore.includes("File.Move(tempPath, TokenPath, overwrite: true)"),
  "Protocol token handoff is not atomic"
);
must(!authService.includes("CreationTimeUtc"), "Protocol auth relies on stale creation time");
must(
  authService.includes("TryClaimPendingTokenAsync"),
  "Pending protocol token is not claimed before opening a new browser flow"
);
must(
  authService.includes("tokenStore.DeleteIfMatches(token)"),
  "Claimed protocol token is not conditionally consumed"
);
must(
  authService.includes("catch (HttpRequestException)"),
  "Transient protocol claim failures are not retried"
);
must(
  !authService.includes("claimPath"),
  "Protocol claim can leave orphaned plaintext claim files"
);

const launcherProject = fs.readFileSync(
  "desktop/cs2haze/launcher/CS2Haze.Launcher.csproj",
  "utf8"
);
const installerDefinition = fs.readFileSync(
  "desktop/cs2haze/installer/cs2haze.iss",
  "utf8"
);
const manifestRoute = fs.readFileSync(
  "src/app/api/cs2/launcher/manifest/route.ts",
  "utf8"
);
const buildScriptSource = fs.readFileSync(
  "desktop/cs2haze/scripts/build-cs2haze.ps1",
  "utf8"
);
const launcherVersion = launcherProject.match(/<Version>([^<]+)<\/Version>/)?.[1];
const manifestVersion = manifestRoute.match(
  /(?:(?:MINIMUM_SELF_UPDATING_VERSION|SUPPORTED_LAUNCHER_VERSION)\s*=|launcherVersion:)\s*["']([^"']+)["']/
)?.[1];
must(Boolean(launcherVersion), "Launcher project version missing");
must(
  installerDefinition.includes("#ifndef MyAppVersion") &&
    buildScriptSource.includes('"/DMyAppVersion=$launcherVersion"'),
  "Installer version is not derived from the launcher project"
);
must(launcherVersion === manifestVersion, "Launcher and manifest versions differ");

const stableInstallerUrl =
  "https://github.com/almazazamatov22-blip/paracetamolhazeweb/releases/latest/download/CS2Haze-Setup.exe";
const nextConfig = fs.readFileSync("next.config.ts", "utf8");
const downloadRoute = fs.readFileSync("src/app/api/cs2/download/route.ts", "utf8");
must(nextConfig.includes(stableInstallerUrl), "Public download redirect is pinned to a release tag");
must(downloadRoute.includes(stableInstallerUrl), "Download API is pinned to a release tag");

for (const sourcePath of [
  "src/app/67/page.tsx",
  "src/app/kinokadr/page.tsx",
  "src/app/cs2/page.tsx",
  "public/overlays/cs2.html",
  "оверлеи/dashboard.html",
]) {
  const source = fs.readFileSync(sourcePath, "utf8");
  must(
    !source.includes("https://paracetamolhaze.vercel.app"),
    `Operational source points to the disabled deployment: ${sourcePath}`
  );
}

const agent = fs.readFileSync("scripts/cs2-agent.js", "utf8");
const publicAgent = fs.readFileSync("public/cs2-agent.js", "utf8");
const overlay = fs.readFileSync("public/overlays/cs2.html", "utf8");
const generated = fs.readFileSync("src/generated/cs2-agent-source.ts", "utf8");

must(agent.includes('const AGENT_VERSION = "2.0.6";'), "Working agent version changed");
must(agent === publicAgent, "Working agent/public copy differ");
must(
  !agent.includes("https://paracetamolhaze.vercel.app"),
  "Working agent fallback points to the disabled deployment"
);
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

const buildScript = buildScriptSource;
must(!buildScript.includes("--agent=("), "Helper path is passed as an empty Node argument");
must(
  buildScript.includes("Embedded helper compilation failed with exit code"),
  "Native helper compilation errors do not fail the release build"
);

const releaseWorkflow = fs.readFileSync(
  ".github/workflows/build-cs2haze.yml",
  "utf8"
);
must(
  !releaseWorkflow.includes("${{ github.ref_name }}"),
  "Release tag is interpolated directly into PowerShell"
);
must(
  releaseWorkflow.includes("$latestUrl") &&
    releaseWorkflow.includes("'CS2Haze-Setup.exe'") &&
    releaseWorkflow.includes("'cs2haze-launcher.zip'"),
  "Release smoke test does not verify the public latest URL"
);
must(
  releaseWorkflow.includes("latestPointsToTag"),
  "Release smoke test does not prove latest points to the new tag"
);
must(
  releaseWorkflow.includes("CS2Haze.TokenStoreSmoke.csproj"),
  "Protocol token-store smoke test is not part of the release workflow"
);
must(
  releaseWorkflow.includes("CS2Haze.UpdateSmoke.csproj"),
  "Launcher update recovery smoke test is not part of the release workflow"
);

console.log("cs2haze integration verification passed.");
