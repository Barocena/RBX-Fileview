local StringBuffer = require("../stringBuffer")

local YamlFormat = {}

local INDENT_CACHE: { string } = { "" }

local function indentFor(level: number): string
	while #INDENT_CACHE <= level do
		table.insert(INDENT_CACHE, string.rep("  ", #INDENT_CACHE))
	end

	return INDENT_CACHE[level + 1]
end

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

local function appendScalar(buf: StringBuffer.StringBuffer, value: any): ()
	if type(value) == "boolean" or type(value) == "number" then
		if type(value) == "number" then
			if value == math.floor(value) then
				StringBuffer.append(buf, tostring(value))
			else
				StringBuffer.append(buf, string.format("%.6g", value))
			end
			return
		end

		StringBuffer.append(buf, tostring(value))
		return
	end

	if type(value) == "string" then
		local escaped = escapeString(value)
		StringBuffer.append(buf, escaped or '""')
		return
	end

	StringBuffer.append(buf, tostring(value))
end

local function appendArray(buf: StringBuffer.StringBuffer, value: { any }): ()
	StringBuffer.append(buf, "[")

	for index, item in value do
		if index > 1 then
			StringBuffer.append(buf, ", ")
		end

		if isArray(item) then
			appendArray(buf, item)
		else
			appendScalar(buf, item)
		end
	end

	StringBuffer.append(buf, "]")
end

local function appendScalarValue(buf: StringBuffer.StringBuffer, value: any, indentLevel: number): ()
	if isArray(value) then
		appendArray(buf, value)
		return
	end

	if type(value) == "string" then
		local escaped = escapeString(value)
		if escaped then
			StringBuffer.append(buf, escaped)
			return
		end

		StringBuffer.append(buf, "|")
		local blockIndent = indentFor(indentLevel + 1)
		for line in string.gmatch(value, "([^\n]*)\n?") do
			if line ~= "" or string.find(value, "\n", 1, true) then
				StringBuffer.append(buf, "\n")
				StringBuffer.append(buf, blockIndent)
				StringBuffer.append(buf, line)
			end
		end
		return
	end

	appendScalar(buf, value)
end

local function appendPropertyBlock(
	buf: StringBuffer.StringBuffer,
	props: { [string]: any },
	indentLevel: number,
	propertyKeys: { string }?
): ()
	local indent = indentFor(indentLevel)
	local keys = propertyKeys

	if not keys then
		keys = {}
		for propertyKey in props do
			table.insert(keys, tostring(propertyKey))
		end
		table.sort(keys)
	end

	for _, propertyKey in keys do
		StringBuffer.append(buf, indent)
		StringBuffer.append(buf, encodeMappingKey(propertyKey))
		StringBuffer.append(buf, ": ")

		local propertyValue = props[propertyKey]
		if type(propertyValue) == "string" and escapeString(propertyValue) == nil then
			appendScalarValue(buf, propertyValue, indentLevel + 1)
		else
			appendScalarValue(buf, propertyValue, indentLevel)
		end

		StringBuffer.append(buf, "\n")
	end
end

local function countDuplicateLabels(children: { { [string]: any } }): { [string]: number }
	local counts: { [string]: number } = {}
	for _, child in children do
		local label = formatNodeLabel(child.className, child.name)
		counts[label] = (counts[label] or 0) + 1
	end
	return counts
end

local function appendTreeNode(
	buf: StringBuffer.StringBuffer,
	node: { [string]: any },
	indentLevel: number,
	asArrayItem: boolean,
	duplicateIndex: number?,
	duplicateTotal: number?
): ()
	local indent = indentFor(indentLevel)
	local header = formatNodeHeader(node.className, node.name, duplicateIndex, duplicateTotal)

	if asArrayItem then
		StringBuffer.append(buf, indent)
		StringBuffer.append(buf, "- ")
		StringBuffer.append(buf, header)
		StringBuffer.append(buf, ":\n")
	else
		StringBuffer.append(buf, indent)
		StringBuffer.append(buf, header)
		StringBuffer.append(buf, ":\n")
	end

	local bodyIndent = indentFor(indentLevel + 1)

	if node.props then
		StringBuffer.append(buf, bodyIndent)
		StringBuffer.append(buf, "props:\n")
		appendPropertyBlock(buf, node.props, indentLevel + 2, node.propKeys)
	end

	if node.children then
		local duplicateCounts = countDuplicateLabels(node.children)
		local duplicateIndexes: { [string]: number } = {}

		for _, child in node.children do
			local label = formatNodeLabel(child.className, child.name)
			local childDuplicateTotal = duplicateCounts[label]
			local childDuplicateIndex = nil

			if childDuplicateTotal > 1 then
				duplicateIndexes[label] = (duplicateIndexes[label] or 0) + 1
				childDuplicateIndex = duplicateIndexes[label]
			end

			appendTreeNode(buf, child, indentLevel + 1, false, childDuplicateIndex, childDuplicateTotal)
		end
	end
end

function YamlFormat.encode(treeResult)
	local instanceCount = treeResult.stats and treeResult.stats.instanceCount or 0
	local initialCapacity = math.max(4096, instanceCount * 192)
	local buf = StringBuffer.new(initialCapacity)

	if treeResult.root then
		appendTreeNode(buf, treeResult.root, 0, false)
	elseif treeResult.roots then
		local duplicateCounts = countDuplicateLabels(treeResult.roots)
		local duplicateIndexes: { [string]: number } = {}
		local useTopLevelArray = #treeResult.roots > 1

		for _, root in treeResult.roots do
			local label = formatNodeLabel(root.className, root.name)
			local duplicateTotal = duplicateCounts[label]
			local duplicateIndex = nil

			if duplicateTotal > 1 then
				duplicateIndexes[label] = (duplicateIndexes[label] or 0) + 1
				duplicateIndex = duplicateIndexes[label]
			end

			appendTreeNode(buf, root, 0, useTopLevelArray, duplicateIndex, duplicateTotal)
		end
	end

	local output = StringBuffer.finish(buf)
	if #output > 0 and output:sub(-1) == "\n" then
		return output:sub(1, -2)
	end

	return output
end

return YamlFormat
