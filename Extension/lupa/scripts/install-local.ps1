$ErrorActionPreference = "Stop"

$extensionDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$cursorCmd = Join-Path $env:LOCALAPPDATA "Programs/cursor/resources/app/bin/cursor.cmd"

if (-not (Test-Path $cursorCmd)) {
	Write-Error "cursor.cmd not found at $cursorCmd"
}

Push-Location $extensionDir
try {
	Write-Host "Compiling extension..."
	pnpm run compile

	Write-Host "Packaging VSIX..."
	pnpm exec vsce package --no-dependencies --allow-missing-repository

	$vsix = Get-ChildItem -Path $extensionDir -Filter "lupa-*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
	if (-not $vsix) {
		Write-Error "VSIX was not created"
	}

	Write-Host "Installing $($vsix.Name) into Cursor..."
	& $cursorCmd --install-extension $vsix.FullName --force

	Write-Host ""
	Write-Host "Done. Reload Cursor (Ctrl+Shift+P -> Developer: Reload Window), then open a .rbxm file."
}
finally {
	Pop-Location
}
