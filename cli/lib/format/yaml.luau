local Compact = require("./compact")

local YamlFormat = {}

local NODE_KEY_ORDER = { "className", "name", "path", "properties", "children" }

local function needsQuotes(key: string): boolean
	return not string.match(key, "^[%w_]+$")
end

local function encodeMappingKey(key: string): string
	if needsQuotes(key) then
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

local function isArray(value: { any }): boolean
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

local function isTreeNode(value: { [string]: any }): boolean
	return type(value.className) == "string" and type(value.name) == "string" and type(value.path) == "string"
end

local function orderedNodeKeys(value: { [string]: any }): { string }
	if not isTreeNode(value) then
		local keys = {}
		for key in value do
			table.insert(keys, tostring(key))
		end
		table.sort(keys)
		return keys
	end

	local keys = {}
	for _, key in NODE_KEY_ORDER do
		if value[key] ~= nil then
			table.insert(keys, key)
		end
	end
	return keys
end

local function encodeScalarLines(value: any, indentLevel: number): { string }
	local indent = string.rep("  ", indentLevel)

	if type(value) == "boolean" or type(value) == "number" then
		return { tostring(value) }
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

local function encodeScalarBlock(value: any, indentLevel: number, keyPrefix: string, encodedKey: string): { string }
	local scalarLines = encodeScalarLines(value, indentLevel + 1)
	local lines = { `{keyPrefix}{encodedKey}: {scalarLines[1]}` }
	local indent = string.rep("  ", indentLevel)
	for lineIndex = 2, #scalarLines do
		table.insert(lines, `{indent}  {scalarLines[lineIndex]}`)
	end
	return lines
end

local function encodeTreeNode(node: { [string]: any }, indentLevel: number, asArrayItem: boolean): { string }
	local lines = {}
	local keys = orderedNodeKeys(node)

	for index, key in keys do
		local child = node[key]
		local encodedKey = encodeMappingKey(key)
		local itemPrefix = string.rep("  ", indentLevel)
		local keyPrefix = if asArrayItem and index == 1 then `{itemPrefix}- ` else if asArrayItem then `{itemPrefix}  ` else itemPrefix

		if key == "properties" and type(child) == "table" then
			table.insert(lines, `{keyPrefix}{encodedKey}:`)
			local propertyKeys = {}
			for propertyKey in child do
				table.insert(propertyKeys, tostring(propertyKey))
			end
			table.sort(propertyKeys)

			local propertyIndent = if asArrayItem then itemPrefix .. "    " else itemPrefix .. "  "
			for _, propertyKey in propertyKeys do
				local propertyValue = child[propertyKey]
				local propertyLines = encodeScalarLines(propertyValue, indentLevel + 2)
				table.insert(lines, `{propertyIndent}{encodeMappingKey(propertyKey)}: {propertyLines[1]}`)
				for lineIndex = 2, #propertyLines do
					table.insert(lines, `{propertyIndent}  {propertyLines[lineIndex]}`)
				end
			end
		elseif key == "children" and isArray(child) then
			table.insert(lines, `{keyPrefix}{encodedKey}:`)
			for _, item in child do
				local childLines = encodeTreeNode(item, indentLevel + if asArrayItem then 2 else 1, true)
				for _, line in childLines do
					table.insert(lines, line)
				end
			end
		elseif type(child) ~= "table" then
			local scalarLines = encodeScalarLines(child, indentLevel + 1)
			table.insert(lines, `{keyPrefix}{encodedKey}: {scalarLines[1]}`)
		else
			table.insert(lines, `{keyPrefix}{encodedKey}:`)
			local childLines = encodeMapping(child, indentLevel + 1, false)
			for _, line in childLines do
				table.insert(lines, line)
			end
		end
	end

	return lines
end

local function encodeMapping(value: { [string]: any }, indentLevel: number, asArrayItem: boolean?): { string }
	if isTreeNode(value) then
		return encodeTreeNode(value, indentLevel, asArrayItem == true)
	end

	local lines = {}
	local indent = string.rep("  ", indentLevel)
	local keys = orderedNodeKeys(value)

	for index, key in keys do
		local child = value[key]
		local encodedKey = encodeMappingKey(key)
		local keyPrefix = if asArrayItem and index == 1 then `{indent}- ` else if asArrayItem then `{indent}  ` else indent

		if type(child) ~= "table" then
			local scalarLines = encodeScalarLines(child, indentLevel + 1)
			table.insert(lines, `{keyPrefix}{encodedKey}: {scalarLines[1]}`)
			for lineIndex = 2, #scalarLines do
				table.insert(lines, `{indent}  {scalarLines[lineIndex]}`)
			end
		elseif isArray(child) then
			table.insert(lines, `{keyPrefix}{encodedKey}:`)
			for _, item in child do
				if isTreeNode(item) then
					local nodeLines = encodeTreeNode(item, indentLevel + 1, true)
					for _, line in nodeLines do
						table.insert(lines, line)
					end
				else
					local itemLines = encodeMapping(item, indentLevel + 1, true)
					for _, line in itemLines do
						table.insert(lines, line)
					end
				end
			end
		else
			table.insert(lines, `{keyPrefix}{encodedKey}:`)
			local childLines = encodeMapping(child, indentLevel + 1, false)
			for _, line in childLines do
				table.insert(lines, line)
			end
		end
	end

	return lines
end

function YamlFormat.encode(treeResult)
	local document = Compact.compactTree(treeResult)
	return table.concat(encodeMapping(document, 0, false), "\n")
end

return YamlFormat
