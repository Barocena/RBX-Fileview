local Compact = {}

local function formatNumber(value: number): string
	if value == math.floor(value) then
		return tostring(value)
	end

	return string.format("%.6g", value)
end

function Compact.formatSerialized(value: any): string
	if value == nil then
		return "nil"
	end

	if type(value) == "boolean" or type(value) == "number" then
		if type(value) == "number" then
			return formatNumber(value)
		end
		return tostring(value)
	end

	if type(value) == "string" then
		return value
	end

	if type(value) ~= "table" or value.type == nil then
		return tostring(value)
	end

	local kind = value.type

	if kind == "Vector3" then
		return `Vector3({formatNumber(value.x)}, {formatNumber(value.y)}, {formatNumber(value.z)})`
	end

	if kind == "Vector2" then
		return `Vector2({formatNumber(value.x)}, {formatNumber(value.y)})`
	end

	if kind == "Color3" then
		return `Color3({formatNumber(value.r)}, {formatNumber(value.g)}, {formatNumber(value.b)})`
	end

	if kind == "UDim" then
		return `UDim({formatNumber(value.scale)}, {value.offset})`
	end

	if kind == "UDim2" then
		return `UDim2({Compact.formatSerialized(value.x)}, {Compact.formatSerialized(value.y)})`
	end

	if kind == "CFrame" then
		local position = value.position
		local orientation = value.orientation
		local parts = {
			formatNumber(position[1]),
			formatNumber(position[2]),
			formatNumber(position[3]),
		}
		for index = 1, 9 do
			table.insert(parts, formatNumber(orientation[index]))
		end
		return `CFrame.new({table.concat(parts, ", ")})`
	end

	if kind == "Enum" then
		return `{value.enum}.{value.value}`
	end

	if kind == "Instance" then
		return `<{value.path}>`
	end

	if kind == "BrickColor" then
		return `BrickColor({value.number})`
	end

	if kind == "NumberRange" then
		return `NumberRange.new({formatNumber(value.min)}, {formatNumber(value.max)})`
	end

	if kind == "NumberSequence" then
		local keypoints = {}
		for _, keypoint in value.keypoints do
			table.insert(
				keypoints,
				`NumberSequenceKeypoint.new({formatNumber(keypoint.time)}, {formatNumber(keypoint.value)}, {formatNumber(keypoint.envelope)})`
			)
		end
		return `NumberSequence.new({table.concat(keypoints, ", ")})`
	end

	if kind == "ColorSequence" then
		local keypoints = {}
		for _, keypoint in value.keypoints do
			table.insert(
				keypoints,
				`ColorSequenceKeypoint.new({formatNumber(keypoint.time)}, {Compact.formatSerialized(keypoint.color)})`
			)
		end
		return `ColorSequence.new({table.concat(keypoints, ", ")})`
	end

	if kind == "Rect" then
		return `Rect.new({Compact.formatSerialized(value.min)}, {Compact.formatSerialized(value.max)})`
	end

	if kind == "PhysicalProperties" then
		return `PhysicalProperties.new({formatNumber(value.density)}, {formatNumber(value.friction)}, {formatNumber(value.elasticity)}, {formatNumber(value.frictionWeight)}, {formatNumber(value.elasticityWeight)})`
	end

	if kind == "BinaryString" then
		if value.encoding == "hash" then
			return `BinaryString.hash({value.value}, {value.size})`
		end
		return `BinaryString.base64({value.value})`
	end

	if kind == "Content" then
		return value.uri
	end

	if value.value ~= nil then
		return `{kind}({tostring(value.value)})`
	end

	return `{kind}(...)`
end

function Compact.compactPropertyValue(value: any): any
	if type(value) == "table" and value.type ~= nil then
		return Compact.formatSerialized(value)
	end

	return value
end

function Compact.compactProperties(properties: { [string]: any }): { [string]: any }
	local compacted: { [string]: any } = {}
	for key, propertyValue in properties do
		compacted[key] = Compact.compactPropertyValue(propertyValue)
	end
	return compacted
end

function Compact.compactNode(node: { [string]: any }): { [string]: any }
	local compacted = {
		className = node.className,
		name = node.name,
		path = node.path,
	}

	if node.properties then
		compacted.properties = Compact.compactProperties(node.properties)
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
