# Lupa VS Code Extension

View Roblox place and model files (`.rbxl`, `.rbxlx`, `.rbxm`, `.rbxmx`) as a human-readable YAML or ASCII tree dump powered by the Lupa CLI.

## Requirements

- The **lupa** CLI must be available on your `PATH`, or as `lupa.exe` in your workspace root.
- Alternatively, set **Lupa: Cli Path** (`lupa.cliPath`) in VS Code settings.

Build the CLI from the repo root:

```powershell
darklua process ./cli/Init.luau Out/Bundle.luau
darklua minify Out/Bundle.luau Out/Bundle.luau
lune build Out/Bundle.luau -o lupa.exe
```

## Development

```powershell
cd Extension/lupa
pnpm install
pnpm run compile
```

### Debugging with F5

**Important:** Open `Lupa.code-workspace` at the repo root (single-root). The old two-folder workspace broke `${workspaceFolder}` paths and prevented F5 from launching anything.

1. **File → Open Workspace from File…** → `Lupa.code-workspace`
2. **Run and Debug** → **Run Lupa Extension (skip build)** → **F5**

A **second Cursor window** should open. In that window, open `Test/sample.rbxm`.

### If F5 still does nothing

**Option A — install as a local VSIX** (most reliable in Cursor):

```powershell
cd Extension/lupa
pnpm run install-local
```

Then **Developer: Reload Window** in Cursor and open a `.rbxm` file.

**Option B — manual dev host launcher:**

```powershell
cd Extension/lupa
pnpm run open-dev-host
```

This opens a new Cursor window with the extension loaded — same result as F5, but bypasses the debug adapter.

In the new window, look for **`[Extension Development Host]`** in the title bar and a toast: **Lupa extension loaded (development mode)**.

### Verify the extension loaded

In the **new** window:

- **Extensions** → Lupa (Development Host)
- **Output → Lupa** → `Lupa extension activated`
- **Debug Console** (in the original window, if using F5) → `[Lupa] activate() running`

**If your workspace is `Extension/lupa` only:**

1. Select **Run Extension** (opens parent Lupa repo as workspace so `lupa.exe` and `Test/` are available)
2. Press **F5**

Make sure `lupa.exe` exists in the repo root before opening Roblox files:

```powershell
darklua process ./cli/Init.luau Out/Bundle.luau
lune build Out/Bundle.luau -o lupa.exe
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `lupa.cliPath` | `lupa` | Path to the lupa executable |
| `lupa.dumpFormat` | `yaml` | `yaml` or `tree` output format |
| `lupa.maxDepth` | `null` | Optional depth limit for large files |
| `lupa.includeFullProperties` | `false` | Pass `--full` to include default properties |
| `lupa.setupGitDiff` | `true` | Configure git textconv for YAML diffs in Source Control |
| `lupa.updateGitAttributes` | `true` | Add `diff=lupa` lines to `.gitattributes` when missing |

## Commands

- **Lupa: Refresh** — re-run `lupa dump` for the open file
- **Lupa: Copy Dump Output** — copy the current dump to the clipboard
- **Lupa: Compare Active File With...** — side-by-side YAML diff (use instead of the built-in compare for `.rbxm` files)
- **Lupa: Select for Compare** / **Lupa: Compare with Selected** — explorer compare workflow
- **Lupa: Compare with...** — pick a second Roblox file to diff against

## Diffs

**Explorer:** Roblox files open in the registered **Lupa** custom editor (default), which shows the YAML dump in the normal text editor.

**Git changes:** Click a changed Roblox file in Source Control to open a Lupa YAML diff (HEAD vs working tree). You can also right-click → **Lupa: Open Git Changes**.

**Manual compare:** Command Palette → **Lupa: Compare Active File With...**

**Terminal git diff:** Lupa configures `scripts/lupa-textconv.cmd` as the git `textconv` driver. After extension activation, `git diff` on `.rbxm` files should also show YAML.

## How it works

Roblox files are binary, so Lupa intercepts the default open and redirects to a virtual `lupa:` text document backed by a `TextDocumentContentProvider`. That document is read-only and opens in the normal VS Code text editor with YAML highlighting.

When you open a file, the extension runs:

```powershell
lupa dump <file> --format yaml --stats
```

Explorer opens use the registered **Lupa** editor (`lupa.roblox`). Source Control still uses the diff router for git-backed side-by-side views.
