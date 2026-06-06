local Util = {}

local process = require("@lune/process")
local stdio = require("@lune/stdio")

function Util.getHomePath()
	local osName = process.os

	if osName == "windows" then
		return process.env.USERPROFILE
	elseif osName == "macos" or osName == "linux" then
		return process.env.HOME
	end

	error("Unsupported OS: " .. tostring(osName))
end

function Util.openInEditor(path: string)
	local editor = process.env.EDITOR

	if editor and editor ~= "" then
		process.exec(editor, { path })
		return
	end

	local osName = process.os

	if osName == "windows" then
		process.exec("notepad", { path })
	elseif osName == "macos" then
		process.exec("open", { "-e", path })
	else
		process.exec("nano", { path })
	end
end

function Util.findKeyInsensitive(tbl: { [string]: any }, key: string): (string?, any?)
	local lower = tostring(key):lower()

	for k, v in tbl do
		if tostring(k):lower() == lower then
			return k, v
		end
	end

	return nil
end

type Color = "black" | "blue" | "cyan" | "green" | "purple" | "red" | "reset" | "white" | "yellow"
function Util.Color(text: string, c1: Color, c2: Color?)
	return `{stdio.color(c1)}{text}{c2 and stdio.color(c2) or ""}`
end

function Util.Log(...)
	print(..., stdio.color("reset"))
end

function Util.open(target: string)
	local osName = process.os

	if osName == "windows" then
		process.exec("", { 'explorer "' .. target .. '"' }, { shell = true })
	elseif osName == "macos" then
		process.exec("open", { target })
	else
		process.exec("xdg-open", { target })
	end
end

return Util
