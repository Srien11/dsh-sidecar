[CmdletBinding()]
param(
  [ValidateRange(0, 65535)]
  [int]$Port = 0
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runtimeRoot = 'C:\Users\奈落\.cache\codex-runtimes\codex-primary-runtime\dependencies'
$nodeBin = Join-Path $runtimeRoot 'node\bin'
$pnpmBin = Join-Path $runtimeRoot 'bin\fallback'

$env:Path = "$nodeBin;$pnpmBin;$env:Path"
$env:DSH_HOME = Join-Path $repoRoot '.spike\dsh-home'

New-Item -ItemType Directory -Force -Path $env:DSH_HOME | Out-Null

Write-Host "DSH_HOME=$env:DSH_HOME"
Write-Host "Starting DeepSeek Harness 0.1.0-rc.6 on 127.0.0.1:$Port"

pnpm dlx @deepseek-ai/dsh@0.1.0-rc.6 web --host 127.0.0.1 --port $Port
