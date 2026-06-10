# RBX-Fileview VS Code Extension

View Roblox place and model files (`.rbxl`, `.rbxlx`, `.rbxm`, `.rbxmx`) as a human-readable YAML dump powered by the RBX-Fileview CLI.

## Requirements

- The **rbx-fileview** CLI must be available on your `PATH`, or as `rbx-fileview.exe` in your workspace root.
- Alternatively, set **rbx-fileview: Cli Path** (`rbx-fileview.cliPath`) in VS Code settings.

Build the CLI from the repo root:

```powershell
darklua process ./cli/Init.luau Out/Bundle.luau
darklua minify Out/Bundle.luau Out/Bundle.luau
lune build Out/Bundle.luau -o rbx-fileview.exe
```

## Development

```powershell
cd Extension/rbx-fileview
pnpm install
pnpm run compile
```

### Debugging with F5

**Important:** Open `rbx-fileview.code-workspace` at the repo root (single-root). The old two-folder workspace broke `${workspaceFolder}` paths and prevented F5 from launching anything.

1. **File → Open Workspace from File…** → `rbx-fileview.code-workspace`
2. **Run and Debug** → **Run RBX-Fileview extension (skip build)** → **F5**

A **second Cursor window** should open. In that window, open `Test/sample.rbxm`.

### If F5 still does nothing

**Option A — install as a local VSIX** (most reliable in Cursor):

```powershell
cd Extension/rbx-fileview
pnpm run install-local
```

Then **Developer: Reload Window** in Cursor and open a `.rbxm` file.

**Option B — manual dev host launcher:**

```powershell
cd Extension/rbx-fileview
pnpm run open-dev-host
```

This opens a new Cursor window with the extension loaded — same result as F5, but bypasses the debug adapter.

In the new window, look for **`[Extension Development Host]`** in the title bar and a toast: **RBX-Fileview extension loaded (development mode)**.

### Verify the extension loaded

In the **new** window:

- **Extensions** → RBX-Fileview (Development Host)
- **Output → RBX-Fileview** → `RBX-Fileview extension activated`
- **Debug Console** (in the original window, if using F5) → `[RBX-Fileview] activate() running`

**If your workspace is `Extension/rbx-fileview` only:**

1. Select **Run Extension** (opens parent RBX-Fileview repo as workspace so `rbx-fileview.exe` and `Test/` are available)
2. Press **F5**

Make sure `rbx-fileview.exe` exists in the repo root before opening Roblox files:

```powershell
darklua process ./cli/Init.luau Out/Bundle.luau
lune build Out/Bundle.luau -o rbx-fileview.exe
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `rbx-fileview.cliPath` | `rbx-fileview` | Path to the rbx-fileview executable |
| `rbx-fileview.maxDepth` | `null` | Optional depth limit for large files |
| `rbx-fileview.includeFullProperties` | `false` | Pass `--full` to include default properties |
| `rbx-fileview.includeSource` | `true` | Include script `Source` text; set `false` for shorter place dumps |
| `rbx-fileview.setupGitDiff` | `true` | Configure git textconv for YAML diffs in Source Control |

## Commands

- **rbx-fileview: Refresh** — re-run `rbx-fileview dump` for the open file
- **rbx-fileview: Copy Dump Output** — copy the current dump to the clipboard
- **rbx-fileview: Compare Active File With...** — side-by-side YAML diff (use instead of the built-in compare for `.rbxm` files)
- **rbx-fileview: Select for Compare** / **rbx-fileview: Compare with Selected** — explorer compare workflow
- **rbx-fileview: Compare with...** — pick a second Roblox file to diff against

## Diffs

Roblox files are binary. **Do not** use `workbench.editorAssociations` with `rbx-fileview.roblox` anywhere — it breaks diffs. The extension removes these automatically on activate.

**Git changes:** Click a changed Roblox file in Source Control to open a RBX-Fileview YAML diff (HEAD vs working tree). You can also right-click → **rbx-fileview: Open Git Changes**.

**Manual compare:** Command Palette → **rbx-fileview: Compare Active File With...**

**Terminal git diff:** On activate, RBX-Fileview writes `diff=rbx-fileview` rules to `.git/info/attributes` (local-only, not committed) and configures `diff.rbx-fileview.textconv` in `.git/config`. After that, `git diff` on `.rbxm` files should show YAML.

## How it works

Roblox files are binary, so RBX-Fileview intercepts the default open and redirects to a virtual `rbx-fileview:` text document backed by a `TextDocumentContentProvider`. That document is read-only and opens in the normal VS Code text editor with YAML highlighting.

When you open a file, the extension runs:

```powershell
RBX-Fileview dump <file> --stats
```

Dump stats appear as `#` comments at the top. External file changes are detected and the open document refreshes automatically.
