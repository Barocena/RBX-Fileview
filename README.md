# Lupa

Human-readable, diff-friendly dumper for Roblox place and model files.

Lupa deserializes `.rbxl`, `.rbxlx`, `.rbxm`, and `.rbxmx` files using [Lune](https://lune-org.github.io/) and prints a stable YAML instance tree suitable for terminal inspection, git diffs, and future VS Code integration.

## Requirements

- [Rokit](https://github.com/rojo-rbx/rokit) (installs Lune and Darklua from `rokit.toml`)

## Build

```powershell
darklua process ./cli/Init.luau Out/Bundle.luau
darklua minify Out/Bundle.luau Out/Bundle.luau
lune build Out/Bundle.luau -o lupa.exe
```

Or run the **Compile CLI** task in VS Code.

## Usage

During development, bundle first (Darklua resolves `@self` imports):

```powershell
darklua process ./cli/Init.luau Out/Bundle.luau
lune run Out/Bundle.luau dump Test/sample.rbxl
```

After building `lupa.exe`:

```powershell
lupa dump Test/sample.rbxm
lupa dump Test/sample.rbxl -o place.yaml --stats
lupa dump Test/sample.rbxl --max-depth 2 --no-properties
lupa dump Test/Crossroads_2.rbxl --max-depth 2
```

### Supported files

| Extension | Type  | Format        |
|-----------|-------|---------------|
| `.rbxl`   | Place | Binary        |
| `.rbxlx`  | Place | XML           |
| `.rbxm`   | Model | Binary        |
| `.rbxmx`  | Model | XML           |

### Output

The default output is YAML with:

- Stable child ordering (`Name`, then `ClassName`)
- Sorted property keys
- Default property omission (use `--full` to include defaults)
- Compact one-line Roblox values, e.g. `Vector3(10, 10, 10)`, `Enum.PartType.Ball`, `CFrame.new(...)`, `<Tree/Ball>` for instances
- Instance paths like `/Workspace/Folder/Part` for references and diffs

## Test fixtures

Generate local fixtures:

```powershell
lune run Test/generate_fixtures.luau
lune run cli/Init.luau dump Test/sample.rbxl
```

## VS Code extension

The extension lives in [`Extension/lupa`](Extension/lupa). It opens Roblox files as a read-only virtual text document and runs `lupa dump` to show the YAML output in the normal editor. It also configures git textconv so Source Control diffs and **Lupa: Compare Active File With...** show side-by-side YAML instead of binary.

```powershell
cd Extension/lupa
pnpm install
pnpm run compile
```

Press **F5** in VS Code with the extension folder open to launch an Extension Development Host. Build `lupa.exe` in the repo root first, or set `lupa.cliPath` in settings.

See [Extension/lupa/README.md](Extension/lupa/README.md) for settings and commands.

## Git diffs

```gitattributes
*.rbxl diff=lupa
*.rbxm diff=lupa
```

```ini
[diff "lupa"]
    textconv = lupa dump
```

## License

MIT
