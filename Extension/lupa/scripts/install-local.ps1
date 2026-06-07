$ErrorActionPreference = "Stop"

$extensionDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$vsixPath = Join-Path $extensionDir "lupa.vsix"
$cursorCmd = Join-Path $env:LOCALAPPDATA "Programs/cursor/resources/app/bin/cursor.cmd"

if (-not (Test-Path $cursorCmd)) {
	Write-Error "cursor.cmd not found at $cursorCmd"
}

Push-Location $extensionDir
try {
	Write-Host "Compiling extension..."
	pnpm run compile

	Write-Host "Packaging VSIX..."
	pnpm exec vsce package --no-dependencies --allow-missing-repository -o lupa.vsix

	if (-not (Test-Path $vsixPath)) {
		Write-Error "VSIX was not created at $vsixPath"
	}

	Write-Host "Installing lupa.vsix into Cursor..."
	& $cursorCmd --install-extension $vsixPath --force

	Write-Host ""
	Write-Host "Done. Reload Cursor (Ctrl+Shift+P -> Developer: Reload Window), then open a .rbxm file."
}
finally {
	Pop-Location
}
