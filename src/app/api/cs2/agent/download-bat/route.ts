import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const streamerId = req.nextUrl.searchParams.get('streamerId');
    if (!streamerId) {
      return NextResponse.json({ error: 'streamerId required' }, { status: 400 });
    }

    const host = req.headers.get('host') || 'paracetamolhaze.ru';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;

    // UTF-8 BOM is NOT recommended for batch files, so we write pure UTF-8.
    // Windows chcp 65001 will handle it.
    const batContent = `@echo off
chcp 65001 >nul
title CS2 Interactive Agent Setup
echo =======================================================
echo     CS2 Interactive Agent Auto-Installer ^& Runner
echo =======================================================
echo.

set STREAMER_ID=${streamerId}
set BASE_URL=${baseUrl}

:: Check if node is installed globally
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [+] Найден установленный Node.js в системе.
    set NODE_BIN=node
    goto :download_agent
)

echo [!] Node.js не найден в системе.
echo [+] Загрузка портативной версии Node.js (win-x64)...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-win-x64.zip' -OutFile 'node.zip'"

if not exist node.zip (
    echo [❌] Не удалось скачать Node.js. Проверьте интернет-соединение.
    pause
    exit /b 1
)

echo [+] Распаковка Node.js (это может занять около минуты)...
powershell -Command "Expand-Archive -Path 'node.zip' -DestinationPath 'node_temp' -Force"
del node.zip

if not exist node_temp (
    echo [❌] Не удалось распаковать Node.js.
    pause
    exit /b 1
)

move node_temp\\node-v20.11.0-win-x64 node_portable
rmdir /s /q node_temp

set NODE_BIN=node_portable\\node.exe

:download_agent

echo [+] Загрузка скрипта агента...
set AGENT_URL=%BASE_URL%/api/cs2/agent/download?t=%RANDOM%
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%AGENT_URL%' -OutFile 'cs2-agent.js.tmp'"

if not exist cs2-agent.js.tmp (
    echo [❌] Не удалось скачать cs2-agent.js.tmp
    if exist cs2-agent.js (
        echo [!] Использую старую закэшированную версию.
    ) else (
        pause
        exit /b 1
    )
) else (
    move /y cs2-agent.js.tmp cs2-agent.js >nul
)

:: Create a start.bat shortcut for future quick runs
echo @echo off > start.bat
echo chcp 65001 ^>nul >> start.bat
echo title CS2 Interactive Agent Setup >> start.bat
echo set STREAMER_ID=%STREAMER_ID% >> start.bat
echo set BASE_URL=%BASE_URL% >> start.bat
echo echo [+] Проверка обновлений... >> start.bat
echo set AGENT_URL=%%BASE_URL%%/api/cs2/agent/download?t=%%RANDOM%% >> start.bat
echo powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%%AGENT_URL%%' -OutFile 'cs2-agent.js.tmp' -UseBasicParsing" >> start.bat
echo if exist cs2-agent.js.tmp move /y cs2-agent.js.tmp cs2-agent.js ^>nul >> start.bat
if "%NODE_BIN%"=="node" (
    echo node cs2-agent.js --streamerId=%STREAMER_ID% --baseUrl=%BASE_URL% >> start.bat
) else (
    echo node_portable\\node.exe cs2-agent.js --streamerId=%STREAMER_ID% --baseUrl=%BASE_URL% >> start.bat
)
echo pause >> start.bat

echo.
echo =======================================================
echo [✅] Настройка завершена!
echo [💡] Создан файл 'start.bat' для быстрого запуска в будущем.
echo [🚀] Запуск агента...
echo =======================================================
echo.

call %NODE_BIN% cs2-agent.js --streamerId=%STREAMER_ID% --baseUrl=%BASE_URL%
pause
`;

    const crlfBatContent = batContent.replace(/\r?\n/g, '\r\n');

    // Return the bat file as a download
    return new NextResponse(crlfBatContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="run-cs2-agent.bat"`,
        'Cache-Control': 'no-store, no-cache',
      },
    });
  } catch (err: any) {
    console.error('[cs2/agent/download-bat]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
