$ErrorActionPreference = "Stop"

$extensionDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$vsixPath = Join-Path $extensionDir "rbx-fileview.vsix"
$cursorCmd = Join-Path $env:LOCALAPPDATA "Programs/cursor/resources/app/bin/cursor.cmd"

if (-not (Test-Path $cursorCmd)) {
	Write-Error "cursor.cmd not found at $cursorCmd"
}

Push-Location $extensionDir
try {
	Write-Host "Compiling extension..."
	pnpm run compile

	Write-Host "Packaging VSIX..."
	pnpm exec vsce package --no-dependencies -o rbx-fileview.vsix

	if (-not (Test-Path $vsixPath)) {
		Write-Error "VSIX was not created at $vsixPath"
	}

	Write-Host "Installing rbx-fileview.vsix into Cursor..."
	& $cursorCmd --install-extension $vsixPath --force

	Write-Host ""
	Write-Host "Done. Reload IDE (Ctrl+Shift+P -> Developer: Reload Window), then open a .rbxm file."
	Write-Host "Note: bundled CLI is disabled; rbx-fileview must be on PATH or set via rbx-fileview.cliPath."
}
finally {
	Pop-Location
}
