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

local function compareInstances(a: Instance, b: Instance): boolean
	if a.Name ~= b.Name then
		return a.Name < b.Name
	end

	return a.ClassName < b.ClassName
end

local function sortChildren(children: { Instance })
	table.sort(children, compareInstances)
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
