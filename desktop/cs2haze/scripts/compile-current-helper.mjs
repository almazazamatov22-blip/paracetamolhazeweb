import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=")];
  })
);

const agentPath = path.resolve(args.agent || "");
const outDir = path.resolve(args.out || "");
if (!fs.existsSync(agentPath)) throw new Error(`Agent not found: ${agentPath}`);
fs.mkdirSync(outDir, { recursive: true });

const source = fs.readFileSync(agentPath, "utf8");
const match = source.match(/const csharpCode = `([\s\S]*?)`;\s*\nconst crypto/);
if (!match) throw new Error("Embedded C# helper source not found.");

const csharp = match[1];
const csPath = path.join(outDir, "cs2_input_helper.cs");
const exePath = path.join(outDir, "cs2_input_helper.exe");
const versionPath = path.join(outDir, ".helper_version");
fs.writeFileSync(csPath, csharp, "utf8");

const csc = "C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe";
if (!fs.existsSync(csc)) throw new Error(`csc.exe not found: ${csc}`);

execFileSync(
  csc,
  [
    "/nologo",
    `/out:${exePath}`,
    "/target:winexe",
    "/optimize",
    "/r:System.Windows.Forms.dll",
    "/r:System.Drawing.dll",
    csPath,
  ],
  { stdio: "inherit" }
);

const hash = crypto.createHash("md5").update(csharp).digest("hex");
fs.writeFileSync(versionPath, hash, "utf8");
fs.unlinkSync(csPath);
console.log(`Helper compiled: ${exePath}`);
