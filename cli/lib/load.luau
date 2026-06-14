local fs = require("@lune/fs")
local roblox = require("@lune/roblox")

export type FileFormat = "binary" | "xml"

export type LoadedPlace = {
	kind: "place",
	path: string,
	contentLength: number,
	root: roblox.DataModel,
}

export type LoadedModel = {
	kind: "model",
	path: string,
	contentLength: number,
	roots: { Instance },
}

export type LoadedFile = LoadedPlace | LoadedModel

local Load = {}

local PLACE_EXTENSIONS = {
	rbxl = true,
	rbxlx = true,
}

local MODEL_EXTENSIONS = {
	rbxm = true,
	rbxmx = true,
}

function Load.detectFormat(contents: string): FileFormat
	if contents:sub(1, 8) == "<roblox!" then
		return "binary"
	end

	if contents:sub(1, 7) == "<roblox" then
		return "xml"
	end

	error("Unrecognized Roblox file format (expected <roblox signature)")
end

function Load.getExtension(filePath: string): string
	local extension = filePath:match("%.([^.\\/]+)$")
	if not extension then
		error(`File has no extension: {filePath}`)
	end

	return extension:lower()
end

function Load.loadFile(filePath: string): LoadedFile
	if not fs.isFile(filePath) then
		error(`File not found: {filePath}`)
	end

	local extension = Load.getExtension(filePath)
	local contents = fs.readFile(filePath)
	Load.detectFormat(contents)

	if PLACE_EXTENSIONS[extension] then
		local root = roblox.deserializePlace(contents)
		return {
			kind = "place",
			path = filePath,
			contentLength = #contents,
			root = root,
		}
	end

	if MODEL_EXTENSIONS[extension] then
		local roots = roblox.deserializeModel(contents)
		return {
			kind = "model",
			path = filePath,
			contentLength = #contents,
			roots = roots,
		}
	end

	error(`Unsupported file extension ".{extension}" (expected .rbxl, .rbxlx, .rbxm, or .rbxmx)`)
end

return Load
