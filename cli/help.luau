local Help
local Util = require("@self/util")
local Color = Util.Color

function Help(VERSION: string, CLI_NAME: string)
	print(Color(CLI_NAME, "yellow", "cyan") .. " " .. VERSION)
	print(Color("A Lune CLI tool.", "blue"))
	print("")

	print(Color("USAGE", "purple", "cyan"))
	print("  " .. Color(CLI_NAME, "cyan", "reset") .. "				Run the default action")
	print("  " .. Color(CLI_NAME .. " <command>", "cyan", "reset") .. "		Run a subcommand")
	print("")

	print(Color("OPTIONS", "purple", "cyan"))
	print("  " .. Color("-h, --help", "cyan", "reset") .. "			Show this help message")
	print("  " .. Color("-v, --version", "cyan", "reset") .. "			Show CLI version")
	print("")

	print(Color("EXAMPLES", "purple", "cyan"))
	print(`  {CLI_NAME}`)
	print(`  {CLI_NAME} --help`)
	print(`  {CLI_NAME} --version`)
	Util.Log("")
end

return Help
