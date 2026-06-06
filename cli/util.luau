local Util = {}

local stdio = require("@lune/stdio")

type Color = "black" | "blue" | "cyan" | "green" | "purple" | "red" | "reset" | "white" | "yellow"

function Util.Color(text: string, c1: Color, c2: Color?)
	return `{stdio.color(c1)}{text}{c2 and stdio.color(c2) or ""}`
end

function Util.Log(...)
	print(..., stdio.color("reset"))
end

return Util
