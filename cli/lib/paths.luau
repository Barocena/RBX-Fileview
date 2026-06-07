local Paths = {}

function Paths.fromFullName(fullName: string): string
	if fullName == "" or fullName == "Game" then
		return "/"
	end

	if fullName:sub(1, 5) == "Game." then
		fullName = fullName:sub(6)
	end

	return "/" .. fullName:gsub("%.", "/")
end

function Paths.childPath(parentPath: string, name: string): string
	if parentPath == "/" then
		return `/{name}`
	end

	return `{parentPath}/{name}`
end

function Paths.buildPathMap(instances: { Instance })
	local pathMap: { [Instance]: string } = {}

	local function visit(instance: Instance, parentPath: string?)
		local path: string
		if parentPath == nil then
			if instance.Name == "Game" or instance.ClassName == "DataModel" then
				path = "/"
			else
				path = Paths.childPath("/", instance.Name)
			end
		else
			path = Paths.childPath(parentPath, instance.Name)
		end

		pathMap[instance] = path

		for _, child in instance:GetChildren() do
			visit(child, path)
		end
	end

	for _, instance in instances do
		visit(instance, nil)
	end

	return pathMap
end

return Paths
