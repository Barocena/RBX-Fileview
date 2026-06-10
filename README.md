# RBX-Fileview

Human-readable, diff-friendly dumper for Roblox place and model files.

RBX-Fileview deserializes `.rbxl`, `.rbxlx`, `.rbxm`, and `.rbxmx` files using [Lune](https://lune-org.github.io/) and prints a stable YAML instance tree suitable for terminal inspection, git diffs, and future VS Code integration.

## Requirements

- [Rokit](https://github.com/rojo-rbx/rokit) (installs Lune and Darklua from `rokit.toml`)

## Build

```powershell
darklua process ./cli/Init.luau Out/Bundle.luau
darklua minify Out/Bundle.luau Out/Bundle.luau
lune build Out/Bundle.luau -o rbx-fileview.exe
```

Or run the **Compile CLI** task in VS Code.

## Usage

During development, bundle first (Darklua resolves `@self` imports):

```powershell
darklua process ./cli/Init.luau Out/Bundle.luau
lune run Out/Bundle.luau dump Test/sample.rbxl
```

After building `rbx-fileview.exe`:

```powershell
rbx-fileview dump Test/sample.rbxm
rbx-fileview dump Test/sample.rbxl -o place.yaml --stats
rbx-fileview dump Test/sample.rbxl --max-depth 2 --no-properties
rbx-fileview dump Test/Crossroads_2.rbxl --max-depth 2
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

- Instance lines like `- Part "Name":` or nested `Part "Name":` keys with a foldable `props:` block
- Child instances appear directly under their parent (no `children:` wrapper)
- Stable child ordering (`Name`, then `ClassName`)
- Sorted property keys
- Default property omission (use `--full` to include defaults)
- Script `Source` included by default (use `--no-source` to omit script text)
- Native YAML arrays for numeric types (Vector3, CFrame, Color3, etc.)
- Short enum values (for example `Smooth` instead of `Enum.SurfaceType.Smooth`)
- Instance references like `Tree_Pink/Ball`

## Test fixtures

Generate local fixtures:

```powershell
lune run Test/generate_fixtures.luau
lune run cli/Init.luau dump Test/sample.rbxl
```

## Benchmark

Time `dump` for every Roblox file in `Test/`:

```powershell
darklua process ./cli/Init.luau Out/Bundle.luau
lune run Out/Bundle.luau benchmark
```

After building `rbx-fileview.exe`:

```powershell
rbx-fileview benchmark
rbx-fileview benchmark Test --iterations 5 --warmup 2
```

Each file is warmed up once (to populate caches), then measured over several iterations. The report shows file size, instance count, output size, and min/median/max dump time.

## VS Code extension

The extension lives in [`Extension/rbx-fileview`](Extension/rbx-fileview). It opens Roblox files as a read-only virtual text document and runs `rbx-fileview dump` to show the YAML output in the normal editor. It also configures git textconv so Source Control diffs and **rbx-fileview: Compare Active File With...** show side-by-side YAML instead of binary.

```powershell
cd Extension/rbx-fileview
pnpm install
pnpm run compile
```

Press **F5** in VS Code with the extension folder open to launch an Extension Development Host. Build `rbx-fileview.exe` in the repo root first, or set `rbx-fileview.cliPath` in settings.

See [Extension/rbx-fileview/README.md](Extension/rbx-fileview/README.md) for settings and commands.

## Git diffs

The VS Code extension configures this automatically per clone in `.git/info/attributes` and `.git/config` (nothing added to your working tree). For manual setup:

```gitattributes
*.rbxl diff=rbx-fileview
*.rbxm diff=rbx-fileview
```

```ini
[diff "rbx-fileview"]
    textconv = rbx-fileview dump
```

## License

MIT
