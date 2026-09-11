# Requires: PowerShell 5+
# Idempotente: copia docs operacionais para docs-local/ (gitignored).
# Nao apaga docs-local existente; nao sobrescreve *-test-user.md ja preenchidos.
# Uso (raiz do repo):
#   pwsh scripts/migrate-docs-to-local.ps1

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$docsLocal = Join-Path $RepoRoot "docs-local"
$docsSrc = Join-Path $RepoRoot "docs"
$agentsSrc = Join-Path $RepoRoot "AGENTS.md"
$cursorSrc = Join-Path $RepoRoot ".cursor"

function Copy-TreeMerging {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  if (-not (Test-Path $Source)) {
    return
  }

  New-Item -ItemType Directory -Path $Destination -Force | Out-Null

  Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
    $destItem = Join-Path $Destination $_.Name
    if ($_.PSIsContainer) {
      Copy-TreeMerging -Source $_.FullName -Destination $destItem
      return
    }

    $isCredentialStub = $_.Name -like "*-test-user.md"
    if ($isCredentialStub -and (Test-Path -LiteralPath $destItem)) {
      Write-Host "Skip (credencial ja existe): $destItem"
      return
    }

    Copy-Item -LiteralPath $_.FullName -Destination $destItem -Force
  }
}

if (Test-Path $docsLocal) {
  Write-Warning "docs-local/ ja existe. Mesclando copias; arquivos *-test-user.md existentes nao serao sobrescritos."
} else {
  New-Item -ItemType Directory -Path $docsLocal | Out-Null
  Write-Host "Criado docs-local/"
}

if (Test-Path $docsSrc) {
  Copy-TreeMerging -Source $docsSrc -Destination $docsLocal
  Write-Host "Copiado docs/ -> docs-local/"
} else {
  Write-Host "docs/ ausente (ja removido do working tree?). Nada a copiar da pasta docs."
}

if (Test-Path $agentsSrc) {
  Copy-Item -LiteralPath $agentsSrc -Destination (Join-Path $docsLocal "AGENTS.md") -Force
  Write-Host "Copiado AGENTS.md -> docs-local/AGENTS.md"
} elseif (Test-Path (Join-Path $docsLocal "AGENTS.md")) {
  Write-Host "AGENTS.md ja esta em docs-local/ (raiz ausente)."
} else {
  Write-Warning "AGENTS.md nao encontrado na raiz nem em docs-local/."
}

$cursorDest = Join-Path $docsLocal "cursor"
if (Test-Path $cursorSrc) {
  Copy-TreeMerging -Source $cursorSrc -Destination $cursorDest
  Write-Host "Copiado .cursor/ -> docs-local/cursor/"
} elseif (Test-Path $cursorDest) {
  Write-Host ".cursor/ ausente; docs-local/cursor/ ja existe."
} else {
  Write-Warning ".cursor/ nao encontrado."
}

Write-Host ""
Write-Host "Concluido. docs-local/ esta no .gitignore — nao commitar."
Write-Host "Quem parte do zero: Copy-Item -Recurse docs-local.example docs-local"
Write-Host "Depois rode este script de novo se docs/ ainda existir no historico local."
