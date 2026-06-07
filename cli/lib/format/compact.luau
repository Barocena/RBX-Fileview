local Compact = {}

local function isArray(value: any): boolean
	if type(value) ~= "table" then
		return false
	end

	local length = #value
	if length == 0 then
		return false
	end

	local count = 0
	for index in value do
		if type(index) ~= "number" then
			return false
		end
		count += 1
	end

	return count == length
end

local function formatInstancePath(path: string): string
	if path == "/" then
		return ""
	end

	if path:sub(1, 1) == "/" then
		return path:sub(2)
	end

	return path
end

local function compactVector2(vector: { x: number, y: number }): { number }
	return { vector.x, vector.y }
end

local function compactColor3(color: { r: number, g: number, b: number }): { number }
	return { color.r, color.g, color.b }
end

function Compact.compactPropertyValue(value: any): any
	if type(value) ~= "table" or value.type == nil then
		return value
	end

	local kind = value.type

	if kind == "Vector3" then
		return { value.x, value.y, value.z }
	end

	if kind == "Vector2" then
		return compactVector2(value)
	end

	if kind == "Color3" then
		return compactColor3(value)
	end

	if kind == "UDim" then
		return { value.scale, value.offset }
	end

	if kind == "UDim2" then
		return {
			value.x.scale,
			value.x.offset,
			value.y.scale,
			value.y.offset,
		}
	end

	if kind == "CFrame" then
		local numbers = {}
		for _, number in value.position do
			table.insert(numbers, number)
		end
		for _, number in value.orientation do
			table.insert(numbers, number)
		end
		return numbers
	end

	if kind == "NumberRange" then
		return { value.min, value.max }
	end

	if kind == "PhysicalProperties" then
		return {
			value.density,
			value.friction,
			value.elasticity,
			value.frictionWeight,
			value.elasticityWeight,
		}
	end

	if kind == "Enum" then
		return value.value
	end

	if kind == "Instance" then
		return formatInstancePath(value.path)
	end

	if kind == "BrickColor" then
		return value.number
	end

	if kind == "UniqueId" then
		return value.value
	end

	if kind == "Rect" then
		local min = compactVector2(value.min)
		local max = compactVector2(value.max)
		return { min[1], min[2], max[1], max[2] }
	end

	if kind == "NumberSequence" then
		local keypoints = table.create(#value.keypoints)
		for index, keypoint in value.keypoints do
			keypoints[index] = { keypoint.time, keypoint.value, keypoint.envelope }
		end
		return keypoints
	end

	if kind == "ColorSequence" then
		local keypoints = table.create(#value.keypoints)
		for index, keypoint in value.keypoints do
			local color = compactColor3(keypoint.color)
			keypoints[index] = { keypoint.time, color[1], color[2], color[3] }
		end
		return keypoints
	end

	if kind == "BinaryString" then
		if value.encoding == "hash" then
			return { value.size, value.value }
		end
		return value.value
	end

	if kind == "Content" then
		return value.uri
	end

	if value.value ~= nil then
		if isArray(value.value) then
			local compacted = table.create(#value.value)
			for index, item in value.value do
				compacted[index] = Compact.compactPropertyValue(item)
			end
			return compacted
		end

		return value.value
	end

	return nil
end

function Compact.compactProperties(properties: { [string]: any }): { [string]: any }
	local compacted: { [string]: any } = {}
	for key, propertyValue in properties do
		local compactedValue = Compact.compactPropertyValue(propertyValue)
		if compactedValue ~= nil then
			compacted[key] = compactedValue
		end
	end
	return compacted
end

function Compact.compactNode(node: { [string]: any }): { [string]: any }
	local compacted = {
		className = node.className,
		name = node.name,
	}

	if node.properties then
		compacted.props = Compact.compactProperties(node.properties)
	end

	if node.children then
		local children = table.create(#node.children)
		for index, child in node.children do
			children[index] = Compact.compactNode(child)
		end
		compacted.children = children
	end

	return compacted
end

function Compact.compactTree(treeResult: { [string]: any }): { [string]: any }
	local compacted = {}

	if treeResult.root then
		compacted.root = Compact.compactNode(treeResult.root)
	end

	if treeResult.roots then
		local roots = table.create(#treeResult.roots)
		for index, root in treeResult.roots do
			roots[index] = Compact.compactNode(root)
		end
		compacted.roots = roots
	end

	return compacted
end

return Compact
