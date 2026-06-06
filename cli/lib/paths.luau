local Paths = {}

function Paths.fromFullName(fullName)
	if fullName == "" or fullName == "Game" then
		return "/"
	end

	if fullName:sub(1, 5) == "Game." then
		fullName = fullName:sub(6)
	end

	return "/" .. fullName:gsub("%.", "/")
end

function Paths.buildPathMap(instances)
	local pathMap = {}

	local function visit(instance)
		local path = Paths.fromFullName(instance:GetFullName())
		pathMap[instance] = path

		for _, child in instance:GetChildren() do
			visit(child)
		end
	end

	for _, instance in instances do
		visit(instance)
	end

	return pathMap
end

return Paths
