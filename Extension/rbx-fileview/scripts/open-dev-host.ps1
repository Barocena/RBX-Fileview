$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../../..")
$extensionPath = Join-Path $repoRoot "Extension/rbx-fileview"
$cursorCmd = Join-Path $env:LOCALAPPDATA "Programs/cursor/resources/app/bin/cursor.cmd"

if (-not (Test-Path $cursorCmd)) {
	Write-Error "cursor.cmd not found at $cursorCmd"
}

if (-not (Test-Path (Join-Path $extensionPath "out/extension.js"))) {
	Write-Host "Compiling extension..."
	Push-Location $extensionPath
	pnpm run compile
	Pop-Location
}

Write-Host "Opening Extension Development Host..."
Write-Host "  extension: $extensionPath"
Write-Host "  workspace: $repoRoot"
Write-Host ""
Write-Host "In the NEW window, you should see:"
Write-Host "  - title bar ends with [Extension Development Host]"
Write-Host "  - a toast: RBX-Fileview extension loaded (development mode)"
Write-Host "  - Extensions sidebar -> RBX-Fileview under Development Host"
Write-Host ""
Write-Host "If you only get a normal window, run: pnpm run install-local"

Start-Process -FilePath $cursorCmd -ArgumentList @(
	"--new-window",
	"--extensionDevelopmentPath=$extensionPath",
	"$repoRoot"
)
