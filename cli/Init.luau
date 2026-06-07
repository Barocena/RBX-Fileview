local process = require("@lune/process")

local Util = require("@self/util")
local Help = require("@self/help")

local VERSION = "0.0.1"
local CLI_NAME = "lupa"

local Color = Util.Color
local Log = Util.Log

local function showUnknownCommand(command: string)
	Log(Color(`Unknown command: {command}`, "red"))
	Log(`Run \`{Color(`{CLI_NAME} --help`, "cyan")}\` for usage.`)
end

local arg = process.args[1]

if not arg then
	Help(VERSION, CLI_NAME)
	return
end

local lower = arg:lower()

if lower == "-h" or lower == "--help" or lower == "help" then
	Help(VERSION, CLI_NAME)
	return
end

if lower == "-v" or lower == "--version" then
	Log(`{Color(CLI_NAME, "yellow", "cyan")} {VERSION}`)
	return
end

if lower == "dump" then
	require("@self/dump").run({ table.unpack(process.args, 2) })
	return
end

if lower == "benchmark" then
	require("@self/benchmark").run({ table.unpack(process.args, 2) })
	return
end

showUnknownCommand(arg)
