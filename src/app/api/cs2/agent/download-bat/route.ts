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
set UPDATER_URL=%BASE_URL%/api/cs2/agent/updater?t=%RANDOM%
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -ErrorAction Stop -Uri '%UPDATER_URL%' -OutFile 'update-cs2-agent.ps1.tmp'"

if exist update-cs2-agent.ps1.tmp (
    move /y update-cs2-agent.ps1.tmp update-cs2-agent.ps1 >nul
) else (
    if not exist update-cs2-agent.ps1 (
        echo [ERROR] Не удалось скачать скрипт обновления и локальная копия отсутствует.
        pause
        exit /b 1
    )
)

powershell -NoProfile -ExecutionPolicy Bypass -File ".\\update-cs2-agent.ps1" -BaseUrl "%BASE_URL%"
set PSERR=%errorlevel%

if %PSERR% neq 0 (
    echo [ERROR] Ошибка при обновлении cs2-agent.js
    if not exist cs2-agent.js (
        echo [ERROR] Агент не найден. Остановка.
        pause
        exit /b 1
    )
)

:: Create a start.bat shortcut for future quick runs
echo @echo off > start.bat
echo chcp 65001 ^>nul >> start.bat
echo title CS2 Interactive Agent Setup >> start.bat
echo set STREAMER_ID=%STREAMER_ID% >> start.bat
echo set BASE_URL=%BASE_URL% >> start.bat
echo echo [+] Проверка обновлений... >> start.bat
echo set UPDATER_URL=%%BASE_URL%%/api/cs2/agent/updater?t=%%RANDOM%% >> start.bat
echo powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -ErrorAction SilentlyContinue -Uri '%%UPDATER_URL%%' -OutFile 'update-cs2-agent.ps1.tmp'" >> start.bat
echo if exist update-cs2-agent.ps1.tmp move /y update-cs2-agent.ps1.tmp update-cs2-agent.ps1 ^>nul >> start.bat
echo if exist update-cs2-agent.ps1 powershell -NoProfile -ExecutionPolicy Bypass -File ".\\update-cs2-agent.ps1" -BaseUrl "%%BASE_URL%%" >> start.bat
echo if not exist cs2-agent.js exit /b 1 >> start.bat
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
