local fs = require("@lune/fs")
local roblox = require("@lune/roblox")

local Instance = roblox.Instance

local function createSampleTree()
	local model = Instance.new("Model")
	model.Name = "SampleModel"

	local folder = Instance.new("Folder")
	folder.Name = "Items"
	folder.Parent = model

	local part = Instance.new("Part")
	part.Name = "AnchorPart"
	part.Anchored = true
	part.Parent = folder

	local script = Instance.new("Script")
	script.Name = "HelloScript"
	script.Source = 'print("hello from lupa fixture")'
	script.Parent = folder

	local objectValue = Instance.new("ObjectValue")
	objectValue.Name = "Target"
	objectValue.Value = part
	objectValue.Parent = folder

	return model
end

local function ensureTestDir()
	if not fs.isDir("Test") then
		fs.writeDir("Test")
	end
end

ensureTestDir()

local model = createSampleTree()

fs.writeFile("Test/sample.rbxm", roblox.serializeModel({ model }, false))
fs.writeFile("Test/sample.rbxmx", roblox.serializeModel({ model }, true))

local game = Instance.new("DataModel")
local workspace = game:GetService("Workspace")
local cloned = model:Clone()
cloned.Parent = workspace

fs.writeFile("Test/sample.rbxl", roblox.serializePlace(game, false))
fs.writeFile("Test/sample.rbxlx", roblox.serializePlace(game, true))

print("Generated Test/sample.rbxm, Test/sample.rbxmx, Test/sample.rbxl, Test/sample.rbxlx")
