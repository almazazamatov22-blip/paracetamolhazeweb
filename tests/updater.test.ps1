param (
    [string]$Url = "https://paracetamolhaze.ru/api/cs2/agent/updater"
)

$ErrorActionPreference = 'Stop'

Write-Host "Running next build to ensure API is ready..."

Write-Host "Testing $Url"
$response = Invoke-WebRequest -Uri $Url -UseBasicParsing -ErrorAction Stop

if ($response.StatusCode -ne 200) {
    throw "HTTP status is not 200: $($response.StatusCode)"
}

$bytes = $response.Content
if ($bytes.Length -lt 2) {
    throw "Response too short"
}

if ($bytes[0] -ne 255 -or $bytes[1] -ne 254) {
    throw "BOM FF FE not found! Got $([System.BitConverter]::ToString($bytes[0..1]))"
}

Write-Host "BOM FF FE verified successfully."

[System.IO.File]::WriteAllBytes("update-cs2-agent.ps1", $bytes)

$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile('update-cs2-agent.ps1', [ref]$null, [ref]$errors) | Out-Null
if ($errors.Count -gt 0) {
    $errors | Format-List
    throw "PowerShell Syntax errors found!"
}

Write-Host "PowerShell script parsed successfully with 0 syntax errors."
