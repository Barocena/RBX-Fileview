local Help
local Util = require("@self/util")
local Color = Util.Color

function Help(VERSION: string, CLI_NAME: string)
	print(Color(CLI_NAME, "yellow", "cyan") .. " " .. VERSION)
	print(Color("Human-readable Roblox place and model file dumper.", "blue"))
	print("")

	print(Color("USAGE", "purple", "cyan"))
	print("  " .. Color(CLI_NAME, "cyan", "reset") .. "                           Show this help message")
	print("  " .. Color(CLI_NAME .. " dump <file>", "cyan", "reset") .. "             Dump a Roblox file as YAML")
	print("  " .. Color(CLI_NAME .. " benchmark [dir]", "cyan", "reset") .. "       Benchmark dump performance")
	print("")

	print(Color("COMMANDS", "purple", "cyan"))
	print("  " .. Color("dump", "cyan", "reset") .. " <file>                 Deserialize and print an instance tree")
	print("  " .. Color("benchmark", "cyan", "reset") .. " [dir]              Time dump runs for Roblox files in a folder")
	print("")

	print(Color("DUMP OPTIONS", "purple", "cyan"))
	print("  " .. Color("-o, --output <path>", "cyan", "reset") .. "         Write output to file (default: stdout)")
	print("  " .. Color("--include-default-properties", "cyan", "reset") .. "  Include properties at their default values")
	print("  " .. Color("--max-depth <n>", "cyan", "reset") .. "         Limit traversal depth")
	print("  " .. Color("--no-properties", "cyan", "reset") .. "          Instance structure only")
	print("  " .. Color("--exclude-property <names>", "cyan", "reset") .. "  Exclude properties from output (comma-separated, repeatable)")
	print("  " .. Color("--stats", "cyan", "reset") .. "                 Print instance counts to stderr")
	print("  " .. Color("--profile", "cyan", "reset") .. "               Print load/encode timings to stderr")
	print("")

	print(Color("BENCHMARK OPTIONS", "purple", "cyan"))
	print("  " .. Color("--iterations <n>", "cyan", "reset") .. "       Measured runs per file (default: 3)")
	print("  " .. Color("--warmup <n>", "cyan", "reset") .. "           Warmup runs per file (default: 1)")
	print("  " .. Color("--no-properties", "cyan", "reset") .. "          Instance structure only")
	print("  " .. Color("--exclude-property <names>", "cyan", "reset") .. "  Exclude properties (comma-separated, repeatable)")
	print("  " .. Color("--profile", "cyan", "reset") .. "               Print load/encode timings to stderr")
	print("")

	print(Color("OPTIONS", "purple", "cyan"))
	print("  " .. Color("-h, --help", "cyan", "reset") .. "                 Show this help message")
	print("  " .. Color("-v, --version", "cyan", "reset") .. "              Show CLI version")
	print("")

	print(Color("EXAMPLES", "purple", "cyan"))
	print(`  {CLI_NAME} dump Test/sample.rbxl`)
	print(`  {CLI_NAME} dump Test/sample.rbxm`)
	print(`  {CLI_NAME} dump Test/sample.rbxl -o place.yaml --stats`)
	print(`  {CLI_NAME} dump Test/Crossroads_2.rbxl --max-depth 2`)
	Util.Log("")
end

return Help
