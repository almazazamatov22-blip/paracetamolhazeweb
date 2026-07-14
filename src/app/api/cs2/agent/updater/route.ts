import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const script = `param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$health = $null
try {
  $health = Invoke-RestMethod -Uri "$BaseUrl/api/cs2/agent/health" -UseBasicParsing
  Write-Host "[INFO] Expected version: $($health.agentVersion)"
} catch {
  Write-Host "[WARN] Health check failed, proceeding without hash validation."
}

$urls = @(
  "$BaseUrl/api/cs2/agent/download?t=$([guid]::NewGuid().ToString())",
  "$BaseUrl/cs2-agent.js?t=$([guid]::NewGuid().ToString())"
)

$success = $false

foreach ($url in $urls) {
  try {
    Write-Host "[INFO] Downloading agent from: $url"
    Invoke-WebRequest -Uri $url -OutFile 'cs2-agent.js.tmp' -UseBasicParsing
    
    $fileInfo = Get-Item 'cs2-agent.js.tmp'
    if ($fileInfo.Length -lt 10240) { throw "File too small ($($fileInfo.Length) bytes)" }
    
    $content = Get-Content 'cs2-agent.js.tmp' -Raw
    if ($content -notmatch 'CS2 Interactive Local Agent' -or $content -notmatch 'AGENT_VERSION') {
      throw "File content validation failed"
    }
    
    if ($health -and $health.sha256) {
      $hash = (Get-FileHash 'cs2-agent.js.tmp' -Algorithm SHA256).Hash.ToLower()
      if ($hash -ne $health.sha256.ToLower()) {
        throw "Hash mismatch. Expected: $($health.sha256), Got: $hash"
      }
    }
    
    $success = $true
    break
  } catch {
    Write-Host "[ERROR] Failed with $url : $($_.Exception.Message)"
  }
}

if (-not $success) {
  Write-Host "[ERROR] All download attempts failed."
  if (Test-Path 'cs2-agent.js') {
    Write-Host "[WARN] Using existing version of cs2-agent.js"
    exit 0
  } else {
    Write-Host "[ERROR] No local agent found. Exiting."
    exit 1
  }
}

if (Test-Path 'cs2-agent.js') {
  Copy-Item 'cs2-agent.js' 'cs2-agent.js.backup' -Force
}
Move-Item 'cs2-agent.js.tmp' 'cs2-agent.js' -Force
Write-Host "[INFO] Agent updated successfully."
exit 0
`;

  const body = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(script, 'utf16le')
  ]);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="update-cs2-agent.ps1"',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}
