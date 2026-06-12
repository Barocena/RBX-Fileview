local Paths = require("./paths")
local Properties = require("./properties")

export type TreeOptions = {
	full: boolean,
	includeProperties: boolean,
	excludedProperties: { [string]: boolean },
	maxDepth: number?,
}

export type TreeNode = {
	className: string,
	name: string,
	props: { [string]: any }?,
	propKeys: { string }?,
	children: { TreeNode }?,
}

export type TreeStats = {
	instanceCount: number,
	maxDepthReached: number,
}

export type TreeResult = {
	root: TreeNode?,
	roots: { TreeNode }?,
	stats: TreeStats,
}

local Tree = {}

local ZERO_UNIQUE_ID = "00000000000000000000000000000000"

type ChildSortEntry = {
	instance: Instance,
	name: string,
	className: string,
	uniqueId: string,
	fileOrder: number,
}

local function readUniqueIdString(instance: Instance): string
	local uid = (instance :: any).UniqueId
	if typeof(uid) ~= "UniqueId" then
		return ""
	end

	local id = tostring(uid)
	if id == ZERO_UNIQUE_ID then
		return ""
	end

	return id
end

local function compareSortEntries(a: ChildSortEntry, b: ChildSortEntry): boolean
	if a.name ~= b.name then
		return a.name < b.name
	end

	if a.className ~= b.className then
		return a.className < b.className
	end

	if a.uniqueId ~= "" and b.uniqueId ~= "" and a.uniqueId ~= b.uniqueId then
		return a.uniqueId < b.uniqueId
	end

	return a.fileOrder < b.fileOrder
end

local function sortChildren(children: { Instance })
	local count = #children
	if count <= 1 then
		return
	end

	local entries = table.create(count)
	local labelCounts: { [string]: number } = {}

	for index = 1, count do
		local child = children[index]
		local name = child.Name
		local className = child.ClassName
		local labelKey = name .. "\0" .. className
		labelCounts[labelKey] = (labelCounts[labelKey] or 0) + 1

		entries[index] = {
			instance = child,
			name = name,
			className = className,
			uniqueId = "",
			fileOrder = index,
		}
	end

	for index = 1, count do
		local entry = entries[index]
		local labelKey = entry.name .. "\0" .. entry.className
		if (labelCounts[labelKey] or 0) > 1 then
			entry.uniqueId = readUniqueIdString(entry.instance)
		end
	end

	table.sort(entries, compareSortEntries)

	for index = 1, count do
		children[index] = entries[index].instance
	end
end

local function buildNode(
	instance: Instance,
	pathMap: { [Instance]: string },
	options: TreeOptions,
	depth: number,
	stats: TreeStats
): TreeNode
	stats.instanceCount += 1
	stats.maxDepthReached = math.max(stats.maxDepthReached, depth)

	local node: TreeNode = {
		className = instance.ClassName,
		name = instance.Name,
	}

	if options.includeProperties then
		local collected = Properties.collect(instance, {
			full = options.full,
			includeProperties = true,
			excludedProperties = options.excludedProperties,
			pathMap = pathMap,
		})

		if collected then
			node.props = collected.props
			node.propKeys = collected.propKeys
		end
	end

	if options.maxDepth ~= nil and depth >= options.maxDepth then
		return node
	end

	local children = instance:GetChildren()
	if #children == 0 then
		return node
	end

	sortChildren(children)

	local childNodes = table.create(#children)
	for _, child in children do
		table.insert(childNodes, buildNode(child, pathMap, options, depth + 1, stats))
	end

	node.children = childNodes
	return node
end

function Tree.buildPlace(root: Instance, options: TreeOptions): TreeResult
	local pathMap = Paths.buildPathMap({ root })
	local stats = {
		instanceCount = 0,
		maxDepthReached = 0,
	}

	return {
		root = buildNode(root, pathMap, options, 0, stats),
		stats = stats,
	}
end

function Tree.buildModel(roots: { Instance }, options: TreeOptions): TreeResult
	local pathMap = Paths.buildPathMap(roots)
	local stats = {
		instanceCount = 0,
		maxDepthReached = 0,
	}

	sortChildren(roots)

	local rootNodes = table.create(#roots)
	for _, root in roots do
		table.insert(rootNodes, buildNode(root, pathMap, options, 0, stats))
	end

	return {
		roots = rootNodes,
		stats = stats,
	}
end

return Tree
