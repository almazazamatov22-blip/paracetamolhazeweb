param(
  [string]$RepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path,
  [string]$UpdateRepository = $env:CS2HAZE_UPDATE_REPOSITORY
)

$ErrorActionPreference = "Stop"
$KitRoot = (Resolve-Path "$PSScriptRoot\..").Path
$Dist = Join-Path $KitRoot "dist"
$LauncherOut = Join-Path $Dist "launcher"
$RuntimeOut = Join-Path $Dist "runtime"

if ([string]::IsNullOrWhiteSpace($UpdateRepository)) {
  $UpdateRepository = "almazazamatov22-blip/paracetamolhazeweb"
}
if ($UpdateRepository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') {
  throw "UpdateRepository must use the owner/repository format."
}

Remove-Item $Dist -Recurse -Force -ErrorAction SilentlyContinue
New-Item $LauncherOut -ItemType Directory -Force | Out-Null
New-Item $RuntimeOut -ItemType Directory -Force | Out-Null

Write-Host "Building cs2haze launcher..."
dotnet publish (Join-Path $KitRoot "launcher\CS2Haze.Launcher.csproj") `
  -c Release -r win-x64 --self-contained true `
  -p:Cs2HazeUpdateRepository=$UpdateRepository `
  -o $LauncherOut
if ($LASTEXITCODE -ne 0) {
  throw "Launcher publish failed with exit code $LASTEXITCODE."
}

Write-Host "Building updater..."
dotnet publish (Join-Path $KitRoot "updater\CS2Haze.Updater.csproj") `
  -c Release -r win-x64 --self-contained true `
  -o $LauncherOut
if ($LASTEXITCODE -ne 0) {
  throw "Updater publish failed with exit code $LASTEXITCODE."
}

New-Item (Join-Path $LauncherOut "Assets") -ItemType Directory -Force | Out-Null
Copy-Item (Join-Path $KitRoot "assets\cs2haze.ico") `
  (Join-Path $LauncherOut "Assets\cs2haze.ico") -Force

Copy-Item (Join-Path $KitRoot "launcher\launcher-config.json") `
  (Join-Path $LauncherOut "launcher-config.json") -Force

Write-Host "Creating launcher self-update archive..."
$launcherProject = [xml](Get-Content (Join-Path $KitRoot "launcher\CS2Haze.Launcher.csproj"))
$launcherVersion = [string]($launcherProject.Project.PropertyGroup.Version | Select-Object -First 1)
if (-not $launcherVersion) {
  throw "Launcher version was not found in CS2Haze.Launcher.csproj."
}

$launcherPackageManifest = Join-Path $LauncherOut "launcher-update.json"
@{
  launcherVersion = $launcherVersion
  entryPoint = "cs2haze.exe"
} | ConvertTo-Json | Set-Content $launcherPackageManifest -Encoding utf8

$launcherZip = Join-Path $Dist "cs2haze-launcher.zip"
Compress-Archive (Join-Path $LauncherOut "*") $launcherZip -Force
$launcherHash = (Get-FileHash $launcherZip -Algorithm SHA256).Hash.ToLowerInvariant()
$launcherHash | Set-Content (Join-Path $Dist "cs2haze-launcher.sha256") -Encoding ascii
Remove-Item $launcherPackageManifest -Force

Write-Host "Downloading latest Node 24 LTS portable runtime..."
$index = Invoke-RestMethod "https://nodejs.org/dist/index.json"
$nodeRelease = $index |
  Where-Object { $_.version -like "v24.*" -and $_.lts } |
  Select-Object -First 1

if (-not $nodeRelease) {
  throw "Latest Node 24 LTS release not found."
}

$nodeVersion = $nodeRelease.version
$nodeZip = Join-Path $env:TEMP "node-$nodeVersion-win-x64.zip"
$nodeExtract = Join-Path $env:TEMP "node-$nodeVersion-win-x64"

Invoke-WebRequest `
  "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-win-x64.zip" `
  -OutFile $nodeZip

Remove-Item $nodeExtract -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive $nodeZip (Split-Path $nodeExtract) -Force
Copy-Item (Join-Path $nodeExtract "node.exe") (Join-Path $RuntimeOut "node.exe") -Force

Write-Host "Bundling agent with esbuild..."
Push-Location $RepoRoot
try {
  $AgentJs = Join-Path $RepoRoot "scripts\cs2-agent.js"
  $OutJs = Join-Path $RuntimeOut "cs2-agent.js"
  & npx esbuild $AgentJs --bundle --platform=node --target=node24 --format=cjs --outfile=$OutJs
  if ($LASTEXITCODE -ne 0) {
    throw "esbuild failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

Write-Host "Compiling the current embedded C# helper..."
$compileHelper = Join-Path $KitRoot "scripts\compile-current-helper.mjs"
$agentPath = Join-Path $RepoRoot "scripts\cs2-agent.js"
node $compileHelper "--agent=$agentPath" "--out=$RuntimeOut"
if ($LASTEXITCODE -ne 0) {
  throw "Embedded helper compilation failed with exit code $LASTEXITCODE."
}

Write-Host "Creating runtime update archive..."
$runtimeZip = Join-Path $Dist "cs2haze-runtime.zip"
Compress-Archive (Join-Path $RuntimeOut "*") $runtimeZip -Force
$hash = (Get-FileHash $runtimeZip -Algorithm SHA256).Hash.ToLowerInvariant()
$hash | Set-Content (Join-Path $Dist "cs2haze-runtime.sha256") -Encoding ascii

Write-Host "Building installer..."
$isccCommand = Get-Command ISCC.exe -ErrorAction SilentlyContinue
$isccPath = if ($isccCommand) { $isccCommand.Source } else { $null }

if (-not $isccPath) {
  $isccCandidates = @()
  if (${env:ProgramFiles(x86)}) {
    $isccCandidates += Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"
  }
  if ($env:ProgramFiles) {
    $isccCandidates += Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe"
  }
  $isccPath = $isccCandidates |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
}

if (-not $isccPath) {
  throw "ISCC.exe not found. Install Inno Setup before running this step."
}
& $isccPath "/DMyAppVersion=$launcherVersion" (Join-Path $KitRoot "installer\cs2haze.iss")
if ($LASTEXITCODE -ne 0) {
  throw "Installer build failed with exit code $LASTEXITCODE."
}

Write-Host "Done."
Write-Host "Installer: $(Join-Path $Dist 'CS2Haze-Setup.exe')"
Write-Host "Launcher update SHA256: $launcherHash"
Write-Host "Runtime SHA256: $hash"
