# RBX-Fileview

View Roblox place and model files (`.rbxl`, `.rbxlx`, `.rbxm`, `.rbxmx`) as a human-readable YAML dump inside VS Code or Cursor.

## Requirements

This extension requires the separate **rbx-fileview** CLI:

1. Download a release from [GitHub Releases](https://github.com/Barocena/RBX-Fileview/releases)
2. Add `rbx-fileview` to your PATH, or set **rbx-fileview: Cli Path** in settings

If the CLI is missing, RBX-Fileview shows a warning when the extension starts.

## Features

- Open Roblox files as a read-only YAML text view
- Refresh and copy dump output from the editor
- Compare two Roblox files side by side
- Git diffs for changed Roblox files in Source Control (YAML instead of binary)
- Optional git diff driver setup for local repositories

## Settings

| Setting | Description |
|---------|-------------|
| `rbx-fileview.cliPath` | Custom CLI path. Leave blank to use PATH. |
| `rbx-fileview.includeDefaultProperties` | Include properties at their default values |
| `rbx-fileview.excludedProperties` | Property names to omit from dump output |
| `rbx-fileview.setupGitConfig` | Configure git for RBX-Fileview diffs |

## Repository

Source code and CLI builds: [github.com/Barocena/RBX-Fileview](https://github.com/Barocena/RBX-Fileview)

## License

MPL-2.0
