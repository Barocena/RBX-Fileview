$ErrorActionPreference = "Stop"

function Get-RepoRoot {
	return Resolve-Path (Join-Path $PSScriptRoot "../../..")
}

function Get-VsceTarget {
	if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
		return "win32-arm64"
	}
	return "win32-x64"
}

function Get-BundledCliName {
	return "rbx-fileview.exe"
}

$extensionDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$repoRoot = Get-RepoRoot
$cliSource = Join-Path $repoRoot (Get-BundledCliName)
$vsceTarget = Get-VsceTarget
$binDir = Join-Path $extensionDir "bin/$vsceTarget"
$binDest = Join-Path $binDir (Get-BundledCliName)

if (-not (Test-Path $cliSource)) {
	Write-Error @"
rbx-fileview.exe not found at: $cliSource

Build the CLI first (Compile CLI task), then run install-local again.
"@
}

New-Item -ItemType Directory -Force -Path $binDir | Out-Null
Copy-Item $cliSource $binDest -Force
Write-Host "Staged bundled CLI: $binDest"
