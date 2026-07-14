import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // UTF-16LE with BOM is intentional: Windows PowerShell 5.1 reads it reliably.
  // Keep console messages ASCII-only for compatibility with older consoles.
  const script = `param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$BaseUrl = $BaseUrl.Trim().TrimEnd('/')
if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  throw 'BaseUrl is empty'
}
if ($BaseUrl -match '\\s') {
  throw "BaseUrl contains whitespace: [$BaseUrl]"
}

$parsedBaseUrl = $null
if (-not [System.Uri]::TryCreate($BaseUrl, [System.UriKind]::Absolute, [ref]$parsedBaseUrl)) {
  throw "Invalid BaseUrl: [$BaseUrl]"
}
if ($parsedBaseUrl.Scheme -ne 'https' -and $parsedBaseUrl.Scheme -ne 'http') {
  throw "Unsupported BaseUrl scheme: $($parsedBaseUrl.Scheme)"
}

Write-Host "[DEBUG] BaseUrl=[$BaseUrl]"

$root = $PSScriptRoot
$target = Join-Path $root 'cs2-agent.js'
$temp = Join-Path $root 'cs2-agent.js.tmp'
$backup = Join-Path $root 'cs2-agent.js.backup'
$health = $null

$healthUrl = $BaseUrl + '/api/cs2/agent/health?t=' + [guid]::NewGuid().ToString()
try {
  $health = Invoke-RestMethod -Uri $healthUrl -ErrorAction Stop
  Write-Host "[INFO] Expected agent version: $($health.agentVersion)"
} catch {
  Write-Host "[WARN] Health check failed: $($_.Exception.Message)"
}

$urls = @(
  ($BaseUrl + '/api/cs2/agent/download?t=' + [guid]::NewGuid().ToString()),
  ($BaseUrl + '/cs2-agent.js?t=' + [guid]::NewGuid().ToString())
)

$success = $false
foreach ($url in $urls) {
  try {
    Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
    Write-Host "[INFO] Downloading agent from: $url"
    Invoke-WebRequest -Uri $url -OutFile $temp -UseBasicParsing -ErrorAction Stop

    if (-not (Test-Path -LiteralPath $temp)) {
      throw 'Temporary agent file was not created'
    }

    $fileInfo = Get-Item -LiteralPath $temp
    if ($fileInfo.Length -lt 10240) {
      throw "File too small: $($fileInfo.Length) bytes"
    }

    if ($health -and $health.sourceLength -and $fileInfo.Length -ne [int64]$health.sourceLength) {
      throw "Length mismatch. Expected $($health.sourceLength), got $($fileInfo.Length)"
    }

    $content = Get-Content -LiteralPath $temp -Raw -Encoding UTF8
    if ($content -notmatch 'CS2 Interactive Local Agent' -or $content -notmatch 'AGENT_VERSION') {
      throw 'File content validation failed'
    }

    $hash = (Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($health -and $health.sha256) {
      $expectedHash = ([string]$health.sha256).ToLowerInvariant()
      if ($hash -ne $expectedHash) {
        throw "Hash mismatch. Expected $expectedHash, got $hash"
      }
    }

    Write-Host "[INFO] Download validated. Bytes=$($fileInfo.Length), SHA256=$hash"
    $success = $true
    break
  } catch {
    Write-Host "[ERROR] Download failed for $url : $($_.Exception.Message)"
  }
}

if (-not $success) {
  Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
  Write-Host '[ERROR] All download attempts failed.'
  if (Test-Path -LiteralPath $target) {
    Write-Host '[WARN] Using the existing local cs2-agent.js.'
    exit 0
  }
  Write-Host '[ERROR] No local agent is available.'
  exit 1
}

if (Test-Path -LiteralPath $target) {
  Copy-Item -LiteralPath $target -Destination $backup -Force
}
Move-Item -LiteralPath $temp -Destination $target -Force
Write-Host '[INFO] Agent updated successfully.'
exit 0
`;

  const body = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(script.replace(/\r?\n/g, '\r\n'), 'utf16le'),
  ]);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="update-cs2-agent.ps1"',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Length': body.length.toString(),
    },
  });
}
