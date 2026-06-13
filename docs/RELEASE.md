# Release process

RBX-Fileview ships two artifacts:

1. **CLI** — standalone `rbx-fileview` binaries (GitHub Releases)
2. **Extension** — VS Code/Cursor extension with the CLI bundled per platform

## 1. Release the CLI

Push a version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Or run **Release CLI** manually in GitHub Actions with a `tag` input.

The workflow (`.github/workflows/release-cli.yml`):

- Bundles `cli/Init.luau` with Darklua
- Cross-builds with `lune build --target …` for Windows, Linux, and macOS
- Uploads zip assets to a **draft** GitHub Release

Publish the draft release on GitHub when the assets look correct.

### CLI assets

| Archive | Platform |
|---------|----------|
| `rbx-fileview-windows-x86_64.zip` | Windows x64 |
| `rbx-fileview-linux-x86_64.zip` | Linux x64 |
| `rbx-fileview-linux-aarch64.zip` | Linux arm64 |
| `rbx-fileview-macos-x86_64.zip` | macOS Intel |
| `rbx-fileview-macos-aarch64.zip` | macOS Apple Silicon |

## 2. Publish the extension

After the CLI release exists, push an extension tag:

```bash
git tag ext-v1.0.0
git push origin ext-v1.0.0
```

`ext-v1.0.0` bundles CLI release `v1.0.0` (the `ext-` prefix is stripped).

Or run **Publish Extension** manually with:

- `extension_tag` — e.g. `ext-v1.0.0`
- `cli_tag` — e.g. `v1.0.0`
- `publish_marketplace` — enable to upload VSIX files (requires `VSCE_PAT` secret)

The workflow (`.github/workflows/publish-extension.yml`):

- Downloads CLI zips from the GitHub Release
- Stages them under `Extension/rbx-fileview/bin/<vsce-target>/`
- Syncs `package.json` version from the extension tag
- Builds platform-specific VSIX files with `vsce package --target …`

### Marketplace secret

Add a repository secret:

- `VSCE_PAT` — Personal Access Token from [Azure DevOps](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token) with **Marketplace Manage** scope

Marketplace publish is **opt-in** via the manual workflow `publish_marketplace` flag so tag pushes only produce VSIX artifacts unless you explicitly publish.

## Local extension install

Download VSIX artifacts from the **Publish Extension** workflow run, then:

```bash
cursor --install-extension rbx-fileview-win32-x64.vsix
```

## How the bundled CLI works

On activation the extension:

1. Reads `bin/<platform>/rbx-fileview` from the installed VSIX
2. Copies it to `globalStorage/bin/`
3. Uses that path for dumps and git textconv

Override with `rbx-fileview.cliPath`, or use a workspace `rbx-fileview.exe` when developing the repo.
