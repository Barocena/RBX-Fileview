local InstanceOrder = require("./instanceOrder")
local Properties = require("./properties")
local StringBuffer = require("./stringBuffer")
local Values = require("./values")

export type EncodeOptions = {
	full: boolean,
	includeProperties: boolean,
	excludedProperties: { [string]: boolean },
	maxDepth: number?,
	profile: boolean?,
}

export type EncodeProfile = {
	getChildrenSeconds: number,
	prepareChildrenSeconds: number,
	structureWriteSeconds: number,
	finishSeconds: number,
	properties: Properties.PropertyProfile,
}

export type EncodeStats = {
	instanceCount: number,
	maxDepthReached: number,
	profile: EncodeProfile?,
}

export type EncodeResult = {
	output: string,
	stats: EncodeStats,
}

local YamlFormat = {}

local INDENT_CACHE: { string } = { "" }

local function escapeName(name: string): string
	if not string.find(name, '["\\]', 1) then
		return name
	end

	return name:gsub("\\", "\\\\"):gsub('"', '\\"')
end

local function indentFor(level: number): string
	while #INDENT_CACHE <= level do
		table.insert(INDENT_CACHE, string.rep("  ", #INDENT_CACHE))
	end

	return INDENT_CACHE[level + 1]
end

local function formatNodeHeader(className: string, name: string, duplicateIndex: number?, duplicateTotal: number?): string
	if duplicateTotal and duplicateTotal > 1 and duplicateIndex then
		return `{className} "{escapeName(name)}" [{duplicateIndex}]`
	end

	return `{className} "{escapeName(name)}"`
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

local function newProfile(): EncodeProfile
	return {
		getChildrenSeconds = 0,
		prepareChildrenSeconds = 0,
		structureWriteSeconds = 0,
		finishSeconds = 0,
		properties = Properties.newProfile(),
	}
end

local function estimateInitialCapacity(contentLength: number?, includeProperties: boolean): number
	if not contentLength then
		return 4096
	end

	if includeProperties then
		return math.max(4096, contentLength * 3)
	end

	return math.max(4096, math.floor(contentLength / 5))
end

type TraversalFrame = {
	instance: Instance,
	depth: number,
	indentLevel: number,
	asArrayItem: boolean,
	duplicateIndex: number?,
	duplicateTotal: number?,
	phase: "node" | "children",
	nextChildIndex: number,
	children: { Instance }?,
	duplicateMetadata: InstanceOrder.DuplicateMetadata?,
}

local framePool: { TraversalFrame } = {}

local function acquireFrame(
	instance: Instance,
	depth: number,
	indentLevel: number,
	asArrayItem: boolean,
	duplicateIndex: number?,
	duplicateTotal: number?
): TraversalFrame
	local frame = table.remove(framePool)
	if frame then
		frame.instance = instance
		frame.depth = depth
		frame.indentLevel = indentLevel
		frame.asArrayItem = asArrayItem
		frame.duplicateIndex = duplicateIndex
		frame.duplicateTotal = duplicateTotal
		frame.phase = "node"
		frame.nextChildIndex = 1
		frame.children = nil
		frame.duplicateMetadata = nil
		return frame
	end

	return {
		instance = instance,
		depth = depth,
		indentLevel = indentLevel,
		asArrayItem = asArrayItem,
		duplicateIndex = duplicateIndex,
		duplicateTotal = duplicateTotal,
		phase = "node",
		nextChildIndex = 1,
	}
end

local function releaseFrame(frame: TraversalFrame)
	frame.instance = nil :: any
	frame.children = nil
	frame.duplicateMetadata = nil
	table.insert(framePool, frame)
end

local function appendInstanceTree(
	buf: StringBuffer.StringBuffer,
	root: Instance,
	options: EncodeOptions,
	propertyContext: Values.SerializeContext,
	propertyWriter: Properties.PropertyWriter,
	stats: EncodeStats,
	rootAsArrayItem: boolean,
	rootDuplicateIndex: number?,
	rootDuplicateTotal: number?
): ()
	local stack: { TraversalFrame } = {
		acquireFrame(root, 0, 0, rootAsArrayItem, rootDuplicateIndex, rootDuplicateTotal),
	}

	while #stack > 0 do
		local frame = stack[#stack]

		if frame.phase == "node" then
			stats.instanceCount += 1
			stats.maxDepthReached = math.max(stats.maxDepthReached, frame.depth)

			local structureStarted = if stats.profile then os.clock() else 0
			local indent = indentFor(frame.indentLevel)
			local header = formatNodeHeader(
				frame.instance.ClassName,
				frame.instance.Name,
				frame.duplicateIndex,
				frame.duplicateTotal
			)
			local linePrefix = if frame.asArrayItem then `{indent}- {header}:\n` else `{indent}{header}:\n`
			StringBuffer.append(buf, linePrefix)
			if stats.profile then
				stats.profile.structureWriteSeconds += os.clock() - structureStarted
			end

			if options.includeProperties then
				Properties.appendToBuffer(
					buf,
					frame.instance,
					{
						full = options.full,
						includeProperties = true,
						excludedProperties = options.excludedProperties,
						propertyContext = propertyContext,
					},
					indentFor(frame.indentLevel + 1),
					indentFor(frame.indentLevel + 2),
					propertyWriter,
					frame.indentLevel + 2,
					if stats.profile then stats.profile.properties else nil
				)
			end

			if options.maxDepth ~= nil and frame.depth >= options.maxDepth then
				local finished = table.remove(stack) :: TraversalFrame
				releaseFrame(finished)
				continue
			end

			local getChildrenStarted = if stats.profile then os.clock() else 0
			local children = frame.instance:GetChildren()
			if stats.profile then
				stats.profile.getChildrenSeconds += os.clock() - getChildrenStarted
			end

			if #children == 0 then
				local finished = table.remove(stack) :: TraversalFrame
				releaseFrame(finished)
				continue
			end

			local prepareStarted = if stats.profile then os.clock() else 0
			local duplicateMetadata = InstanceOrder.prepareChildren(children)
			if stats.profile then
				stats.profile.prepareChildrenSeconds += os.clock() - prepareStarted
			end

			frame.phase = "children"
			frame.children = children
			frame.duplicateMetadata = duplicateMetadata
			frame.nextChildIndex = 1
		else
			local children = frame.children :: { Instance }
			local duplicateMetadata = frame.duplicateMetadata :: InstanceOrder.DuplicateMetadata
			local childIndex = frame.nextChildIndex

			if childIndex > #children then
				local finished = table.remove(stack) :: TraversalFrame
				releaseFrame(finished)
				continue
			end

			frame.nextChildIndex = childIndex + 1
			local duplicate = duplicateMetadata[childIndex]

			table.insert(
				stack,
				acquireFrame(
					children[childIndex],
					frame.depth + 1,
					frame.indentLevel + 1,
					false,
					if duplicate then duplicate.index else nil,
					if duplicate then duplicate.total else nil
				)
			)
		end
	end
end

local function encodeRoots(
	_roots: { Instance },
	options: EncodeOptions,
	capacityHint: number?,
	appendTree: (
		buf: StringBuffer.StringBuffer,
		propertyContext: Values.SerializeContext,
		propertyWriter: Properties.PropertyWriter,
		stats: EncodeStats
	) -> ()
): EncodeResult
	local stats: EncodeStats = {
		instanceCount = 0,
		maxDepthReached = 0,
		profile = if options.profile then newProfile() else nil,
	}

	local buf = StringBuffer.new(estimateInitialCapacity(capacityHint, options.includeProperties))
	local propertyContext: Values.SerializeContext = {
		pathCache = {},
	}
	local propertyWriter: Properties.PropertyWriter = {
		appendScalarValue = appendScalarValue,
	}

	appendTree(buf, propertyContext, propertyWriter, stats)

	local finishStarted = if stats.profile then os.clock() else 0
	local output = StringBuffer.finish(buf, true)
	if stats.profile then
		stats.profile.finishSeconds = os.clock() - finishStarted
	end

	return {
		output = output,
		stats = stats,
	}
end

function YamlFormat.encodePlace(root: Instance, options: EncodeOptions, capacityHint: number?): EncodeResult
	return encodeRoots({ root }, options, capacityHint, function(buf, propertyContext, propertyWriter, stats)
		appendInstanceTree(buf, root, options, propertyContext, propertyWriter, stats, false)
	end)
end

function YamlFormat.encodeModel(roots: { Instance }, options: EncodeOptions, capacityHint: number?): EncodeResult
	return encodeRoots(roots, options, capacityHint, function(buf, propertyContext, propertyWriter, stats)
		local rootCount = #roots
		local duplicateMetadata = InstanceOrder.prepareChildren(roots)
		local useTopLevelArray = rootCount > 1

		for index = 1, rootCount do
			local duplicate = duplicateMetadata[index]
			appendInstanceTree(
				buf,
				roots[index],
				options,
				propertyContext,
				propertyWriter,
				stats,
				useTopLevelArray,
				if duplicate then duplicate.index else nil,
				if duplicate then duplicate.total else nil
			)
		end
	end)
end

return YamlFormat
