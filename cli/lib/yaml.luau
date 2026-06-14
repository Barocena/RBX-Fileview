local InstanceOrder = require("./instanceOrder")
local Properties = require("./properties")
local StringBuffer = require("./stringBuffer")

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

local function appendInstanceNode(
	buf: StringBuffer.StringBuffer,
	instance: Instance,
	options: EncodeOptions,
	propertyContext: Properties.PropertyCollectContext,
	propertyWriter: Properties.PropertyWriter,
	stats: EncodeStats,
	depth: number,
	indentLevel: number,
	asArrayItem: boolean,
	duplicateIndex: number?,
	duplicateTotal: number?
): ()
	stats.instanceCount += 1
	stats.maxDepthReached = math.max(stats.maxDepthReached, depth)

	local structureStarted = if stats.profile then os.clock() else 0
	local indent = indentFor(indentLevel)
	local header = formatNodeHeader(instance.ClassName, instance.Name, duplicateIndex, duplicateTotal)
	local linePrefix = if asArrayItem then `{indent}- {header}:\n` else `{indent}{header}:\n`
	StringBuffer.append(buf, linePrefix)
	if stats.profile then
		stats.profile.structureWriteSeconds += os.clock() - structureStarted
	end

	if options.includeProperties then
		Properties.appendToBuffer(
			buf,
			instance,
			{
				full = options.full,
				includeProperties = true,
				excludedProperties = options.excludedProperties,
				propertyContext = propertyContext,
			},
			indentFor(indentLevel + 1),
			indentFor(indentLevel + 2),
			propertyWriter,
			indentLevel + 2,
			if stats.profile then stats.profile.properties else nil
		)
	end

	if options.maxDepth ~= nil and depth >= options.maxDepth then
		return
	end

	local getChildrenStarted = if stats.profile then os.clock() else 0
	local children = instance:GetChildren()
	if stats.profile then
		stats.profile.getChildrenSeconds += os.clock() - getChildrenStarted
	end

	local childCount = #children
	if childCount == 0 then
		return
	end

	local prepareStarted = if stats.profile then os.clock() else 0
	local duplicateMetadata = InstanceOrder.prepareChildren(children)
	if stats.profile then
		stats.profile.prepareChildrenSeconds += os.clock() - prepareStarted
	end

	for index = 1, childCount do
		local duplicate = duplicateMetadata[index]
		appendInstanceNode(
			buf,
			children[index],
			options,
			propertyContext,
			propertyWriter,
			stats,
			depth + 1,
			indentLevel + 1,
			false,
			if duplicate then duplicate.index else nil,
			if duplicate then duplicate.total else nil
		)
	end
end

local function appendInstanceRoots(
	buf: StringBuffer.StringBuffer,
	roots: { Instance },
	options: EncodeOptions,
	propertyContext: Properties.PropertyCollectContext,
	propertyWriter: Properties.PropertyWriter,
	stats: EncodeStats
): ()
	local rootCount = #roots
	local duplicateMetadata = InstanceOrder.prepareChildren(roots)
	local useTopLevelArray = rootCount > 1

	for index = 1, rootCount do
		local duplicate = duplicateMetadata[index]
		appendInstanceNode(
			buf,
			roots[index],
			options,
			propertyContext,
			propertyWriter,
			stats,
			0,
			0,
			useTopLevelArray,
			if duplicate then duplicate.index else nil,
			if duplicate then duplicate.total else nil
		)
	end
end

function YamlFormat.encodePlace(root: Instance, options: EncodeOptions, capacityHint: number?): EncodeResult
	local stats: EncodeStats = {
		instanceCount = 0,
		maxDepthReached = 0,
		profile = if options.profile then newProfile() else nil,
	}

	local initialCapacity = if capacityHint then math.max(4096, capacityHint * 3) else 4096
	local buf = StringBuffer.new(initialCapacity)
	local propertyContext: Properties.PropertyCollectContext = {
		pathCache = {},
		full = options.full,
	}
	local propertyWriter: Properties.PropertyWriter = {
		appendScalarValue = appendScalarValue,
	}

	appendInstanceNode(buf, root, options, propertyContext, propertyWriter, stats, 0, 0, false)

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

function YamlFormat.encodeModel(roots: { Instance }, options: EncodeOptions, capacityHint: number?): EncodeResult
	local stats: EncodeStats = {
		instanceCount = 0,
		maxDepthReached = 0,
		profile = if options.profile then newProfile() else nil,
	}

	local initialCapacity = if capacityHint then math.max(4096, capacityHint * 3) else 4096
	local buf = StringBuffer.new(initialCapacity)
	local propertyContext: Properties.PropertyCollectContext = {
		pathCache = {},
		full = options.full,
	}
	local propertyWriter: Properties.PropertyWriter = {
		appendScalarValue = appendScalarValue,
	}

	appendInstanceRoots(buf, roots, options, propertyContext, propertyWriter, stats)

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

return YamlFormat
