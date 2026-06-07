local Compact = require("./compact")

local YamlFormat = {}

local function escapeNameForLabel(name: string): string
	return name:gsub("\\", "\\\\"):gsub('"', '\\"')
end

local function formatNodeLabel(className: string, name: string): string
	return `{className} "{escapeNameForLabel(name)}"`
end

local function formatNodeHeader(className: string, name: string, duplicateIndex: number?, duplicateTotal: number?): string
	local label = formatNodeLabel(className, name)
	if duplicateTotal and duplicateTotal > 1 and duplicateIndex then
		return `{label} [{duplicateIndex}]`
	end
	return label
end

local function encodeMappingKey(key: string): string
	if not string.match(key, "^[%w_]+$") then
		return `'{key:gsub("'", "''")}'`
	end
	return key
end

local function escapeString(value: string): string?
	if string.find(value, "\n", 1, true) then
		return nil
	end

	if value == "" then
		return '""'
	end

	if string.match(value, "^[%w_%.:/<>@(),-]+$") then
		return value
	end

	return `"{value:gsub('"', '\\"')}"`
end

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

local function formatScalar(value: any): string
	if type(value) == "boolean" or type(value) == "number" then
		if type(value) == "number" then
			if value == math.floor(value) then
				return tostring(value)
			end
			return string.format("%.6g", value)
		end
		return tostring(value)
	end

	if type(value) == "string" then
		return escapeString(value) or '""'
	end

	return tostring(value)
end

local function encodeArrayValue(value: { any }): string
	local parts = table.create(#value)
	for _, item in value do
		if isArray(item) then
			table.insert(parts, encodeArrayValue(item))
		else
			table.insert(parts, formatScalar(item))
		end
	end
	return `[{table.concat(parts, ", ")}]`
end

local function encodeScalarLines(value: any, indentLevel: number): { string }
	local indent = string.rep("  ", indentLevel)

	if isArray(value) then
		return { encodeArrayValue(value) }
	end

	if type(value) == "boolean" or type(value) == "number" then
		return { formatScalar(value) }
	end

	if type(value) == "string" then
		local escaped = escapeString(value)
		if escaped then
			return { escaped }
		end

		local lines = { "|" }
		for line in string.gmatch(value, "([^\n]*)\n?") do
			if line ~= "" or string.find(value, "\n", 1, true) then
				table.insert(lines, indent .. "  " .. line)
			end
		end
		return lines
	end

	return { tostring(value) }
end

local function encodePropertyBlock(props: { [string]: any }, indentLevel: number): { string }
	local lines = {}
	local indent = string.rep("  ", indentLevel)
	local propertyKeys = {}

	for propertyKey in props do
		table.insert(propertyKeys, tostring(propertyKey))
	end
	table.sort(propertyKeys)

	for _, propertyKey in propertyKeys do
		local propertyValue = props[propertyKey]
		local propertyLines = encodeScalarLines(propertyValue, indentLevel + 1)
		table.insert(lines, `{indent}{encodeMappingKey(propertyKey)}: {propertyLines[1]}`)
		for lineIndex = 2, #propertyLines do
			table.insert(lines, `{indent}  {propertyLines[lineIndex]}`)
		end
	end

	return lines
end

local function countDuplicateLabels(children: { { [string]: any } }): { [string]: number }
	local counts: { [string]: number } = {}
	for _, child in children do
		local label = formatNodeLabel(child.className, child.name)
		counts[label] = (counts[label] or 0) + 1
	end
	return counts
end

local function encodeTreeNode(
	node: { [string]: any },
	indentLevel: number,
	asArrayItem: boolean,
	duplicateIndex: number?,
	duplicateTotal: number?
): { string }
	local lines = {}
	local indent = string.rep("  ", indentLevel)
	local header = formatNodeHeader(node.className, node.name, duplicateIndex, duplicateTotal)

	if asArrayItem then
		table.insert(lines, `{indent}- {header}:`)
	else
		table.insert(lines, `{indent}{header}:`)
	end

	local bodyIndent = string.rep("  ", indentLevel + 1)

	if node.props then
		table.insert(lines, `{bodyIndent}props:`)
		for _, line in encodePropertyBlock(node.props, indentLevel + 2) do
			table.insert(lines, line)
		end
	end

	if node.children then
		local duplicateCounts = countDuplicateLabels(node.children)
		local duplicateIndexes: { [string]: number } = {}

		for _, child in node.children do
			local label = formatNodeLabel(child.className, child.name)
			local duplicateTotal = duplicateCounts[label]
			local duplicateIndex = nil

			if duplicateTotal > 1 then
				duplicateIndexes[label] = (duplicateIndexes[label] or 0) + 1
				duplicateIndex = duplicateIndexes[label]
			end

			for _, line in encodeTreeNode(child, indentLevel + 1, false, duplicateIndex, duplicateTotal) do
				table.insert(lines, line)
			end
		end
	end

	return lines
end

function YamlFormat.encode(treeResult)
	local document = Compact.compactTree(treeResult)
	local lines = {}

	if document.root then
		for _, line in encodeTreeNode(document.root, 0, false) do
			table.insert(lines, line)
		end
	elseif document.roots then
		local duplicateCounts = countDuplicateLabels(document.roots)
		local duplicateIndexes: { [string]: number } = {}
		local useTopLevelArray = #document.roots > 1

		for _, root in document.roots do
			local label = formatNodeLabel(root.className, root.name)
			local duplicateTotal = duplicateCounts[label]
			local duplicateIndex = nil

			if duplicateTotal > 1 then
				duplicateIndexes[label] = (duplicateIndexes[label] or 0) + 1
				duplicateIndex = duplicateIndexes[label]
			end

			for _, line in encodeTreeNode(root, 0, useTopLevelArray, duplicateIndex, duplicateTotal) do
				table.insert(lines, line)
			end
		end
	end

	return table.concat(lines, "\n")
end

return YamlFormat
