# DS-05 Visual QA runner — não imprime senhas
# Uso: pwsh -File docs/assets/ds-05-eventos-newsletter/run-audit.ps1
Set-Location $PSScriptRoot\..\..\..
try {
  $null = Invoke-WebRequest -Uri "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 2
} catch {
  Start-Process -FilePath "pnpm" -ArgumentList @("exec","vite","--host","127.0.0.1","--port","5173") -WorkingDirectory (Get-Location)
  Start-Sleep -Seconds 5
}
node "$PSScriptRoot\_audit.mjs"
