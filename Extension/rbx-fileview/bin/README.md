# Bundled CLI binaries

Platform-specific `rbx-fileview` executables are placed here before packaging the VSIX:

```
bin/
  win32-x64/rbx-fileview.exe
  linux-x64/rbx-fileview
  linux-arm64/rbx-fileview
  darwin-x64/rbx-fileview
  darwin-arm64/rbx-fileview
```

Binaries are built by `.github/workflows/release-cli.yml`. Extension bundling is disabled for now (`BUNDLED_CLI_ENABLED = false` in `src/bundledCli.ts`) until Marketplace allows platform binaries in the VSIX.
