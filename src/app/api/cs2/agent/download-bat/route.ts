import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STREAMER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export async function GET(req: NextRequest) {
  try {
    const streamerId = req.nextUrl.searchParams.get('streamerId')?.trim();
    if (!streamerId || !STREAMER_ID_PATTERN.test(streamerId)) {
      return NextResponse.json({ error: 'invalid streamerId' }, { status: 400 });
    }

    const baseUrl = req.nextUrl.origin.trim().replace(/\/+$/, '');

    // Keep the BAT ASCII-only. This avoids Windows cmd/PowerShell encoding issues.
    // The same file is copied to start.bat, so every future launch runs the updater.
    const batContent = `@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
pushd "%~dp0"
title CS2 Interactive Agent Setup

echo =======================================================
echo     CS2 Interactive Agent Auto-Installer and Runner
echo =======================================================
echo.

set "STREAMER_ID=${streamerId}"
set "BASE_URL=${baseUrl}"
set "NODE_BIN=node"

where node >nul 2>nul
if not errorlevel 1 goto :update_agent

if exist "node_portable\\node.exe" (
    set "NODE_BIN=node_portable\\node.exe"
    goto :update_agent
)

echo [WARN] Node.js was not found. Downloading portable Node.js...
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-win-x64.zip' -OutFile 'node.zip'"
if errorlevel 1 goto :node_error
if not exist "node.zip" goto :node_error

powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath 'node.zip' -DestinationPath 'node_temp' -Force"
if errorlevel 1 goto :node_error
del /q "node.zip" >nul 2>nul

if exist "node_portable" rmdir /s /q "node_portable"
move "node_temp\\node-v20.11.0-win-x64" "node_portable" >nul
rmdir /s /q "node_temp" >nul 2>nul
if not exist "node_portable\\node.exe" goto :node_error
set "NODE_BIN=node_portable\\node.exe"

:update_agent
echo [INFO] Checking for agent updates...
set "UPDATER_URL=%BASE_URL%/api/cs2/agent/updater?t=%RANDOM%%RANDOM%"
del /q "update-cs2-agent.ps1.tmp" >nul 2>nul
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '%UPDATER_URL%' -OutFile 'update-cs2-agent.ps1.tmp'"

if exist "update-cs2-agent.ps1.tmp" (
    move /y "update-cs2-agent.ps1.tmp" "update-cs2-agent.ps1" >nul
) else (
    echo [WARN] Could not download the updater.
)

if exist "update-cs2-agent.ps1" (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\\update-cs2-agent.ps1" -BaseUrl "%BASE_URL%"
    if errorlevel 1 echo [WARN] Agent update failed. Trying the existing local agent.
) else (
    echo [WARN] No updater script is available. Trying the existing local agent.
)

if not exist "cs2-agent.js" goto :agent_error

rem Save this exact self-updating installer as start.bat.
if /I not "%~nx0"=="start.bat" copy /y "%~f0" "start.bat" >nul

echo.
echo [INFO] Starting the CS2 agent...
"%NODE_BIN%" "cs2-agent.js" --streamerId="%STREAMER_ID%" --baseUrl="%BASE_URL%"
set "AGENT_EXIT=%ERRORLEVEL%"
echo.
echo [INFO] Agent exited with code %AGENT_EXIT%.
pause
popd
exit /b %AGENT_EXIT%

:node_error
echo [ERROR] Node.js installation failed.
pause
popd
exit /b 1

:agent_error
echo [ERROR] cs2-agent.js is missing and could not be downloaded.
pause
popd
exit /b 1
`;

    return new NextResponse(batContent.replace(/\r?\n/g, '\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="run-cs2-agent.bat"',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cs2/agent/download-bat]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
