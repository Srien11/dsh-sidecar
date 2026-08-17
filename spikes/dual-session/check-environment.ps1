[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$nodePath = 'C:\Users\奈落\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$pnpmPath = 'C:\Users\奈落\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'

if (-not (Test-Path -LiteralPath $nodePath)) {
  throw "Bundled Node.js was not found at $nodePath"
}

if (-not (Test-Path -LiteralPath $pnpmPath)) {
  throw "Bundled pnpm was not found at $pnpmPath"
}

$nodeVersion = & $nodePath --version
$pnpmVersion = & $pnpmPath --version
$gitRoot = git -C $repoRoot rev-parse --show-toplevel
$gitStatus = @(git -C $repoRoot status --short)

[pscustomobject]@{
  repoRoot = $repoRoot
  node = $nodeVersion
  pnpm = $pnpmVersion
  gitRoot = $gitRoot
  gitClean = $gitStatus.Count -eq 0
  hasDeepSeekApiKey = -not [string]::IsNullOrWhiteSpace($env:DEEPSEEK_API_KEY)
} | ConvertTo-Json
