local Compact = require("./compact")
local Tree = require("../tree")

local TreeFormat = {}

local function formatScalar(value: any): string
	local kind = typeof(value)
	if kind == "string" then
		return value
	end

	if kind == "boolean" or kind == "number" then
		return tostring(value)
	end

	return tostring(value)
end

local function appendPropertyLines(lines: { string }, properties: { [string]: any })
	local keys = {}
	for key in properties do
		table.insert(keys, key)
	end
	table.sort(keys)

	for _, key in keys do
		local value = properties[key]
		if type(value) == "string" and string.find(value, "\n", 1, true) then
			table.insert(lines, `  {key}: |`)
			for line in string.gmatch(value, "[^\n]+") do
				table.insert(lines, `    {line}`)
			end
		elseif type(value) == "table" and value.type ~= nil then
			table.insert(lines, `  {key}: {Compact.formatSerialized(value)}`)
		else
			table.insert(lines, `  {key}: {formatScalar(value)}`)
		end
	end
end

local function renderNode(lines: { string }, node: Tree.TreeNode, prefix: string, isLast: boolean)
	local branch = if isLast then "└── " else "├── "
	table.insert(lines, `{prefix}{branch}[{node.className}] {node.name}`)

	local childPrefix = prefix .. if isLast then "    " else "│   "
	if node.properties then
		appendPropertyLines(lines, node.properties)
	end

	local children = node.children
	if not children or #children == 0 then
		return
	end

	for index, child in children do
		renderNode(lines, child, childPrefix, index == #children)
	end
end

function TreeFormat.encode(treeResult: Tree.TreeResult): string
	local lines = {}

	if treeResult.root then
		renderNode(lines, treeResult.root, "", true)
	end

	if treeResult.roots then
		for index, root in treeResult.roots do
			renderNode(lines, root, "", index == #treeResult.roots)
		end
	end

	return table.concat(lines, "\n")
end

return TreeFormat
