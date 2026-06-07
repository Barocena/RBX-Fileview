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
	print("")

	print(Color("COMMANDS", "purple", "cyan"))
	print("  " .. Color("dump", "cyan", "reset") .. " <file>                 Deserialize and print an instance tree")
	print("")

	print(Color("DUMP OPTIONS", "purple", "cyan"))
	print("  " .. Color("-o, --output <path>", "cyan", "reset") .. "         Write output to file (default: stdout)")
	print("  " .. Color("--full", "cyan", "reset") .. "                   Include default-valued properties")
	print("  " .. Color("--max-depth <n>", "cyan", "reset") .. "         Limit traversal depth")
	print("  " .. Color("--properties", "cyan", "reset") .. "             Include properties (default)")
	print("  " .. Color("--no-properties", "cyan", "reset") .. "          Instance structure only")
	print("  " .. Color("--no-source", "cyan", "reset") .. "             Omit script Source property text")
	print("  " .. Color("--stats", "cyan", "reset") .. "                 Print instance counts to stderr")
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
