local roblox = require("@lune/roblox")
local Values = require("./values")
local StringBuffer = require("./stringBuffer")

export type PropertyCollectContext = Values.SerializeContext

export type PropertyOptions = {
	full: boolean,
	includeProperties: boolean,
	excludedProperties: { [string]: boolean },
	propertyContext: PropertyCollectContext,
}

export type PropertyWriter = {
	appendScalarValue: (buf: StringBuffer.StringBuffer, value: any, indentLevel: number) -> (),
}

export type PropertyProfile = {
	readsSeconds: number,
	compareSeconds: number,
	writeSeconds: number,
}

type PropertyEntry = {
	name: string,
	datatype: string,
	defaultValue: any?,
	defaultCFrameComponents: { number }?,
	defaultEnumName: string?,
	encodedKey: string,
}

type ClassCache = {
	entries: { PropertyEntry },
}

local Properties = {}

local SKIP_PROPERTIES = {
	Parent = true,
	Name = true,
	ClassName = true,
	UniqueId = true,
	HistoryId = true,
}

local SKIP_TAGS = {
	NotScriptable = true,
	Deprecated = true,
	Hidden = true,
}

local classCache: { [string]: ClassCache } = {}

local function shouldSkipProperty(property: roblox.DatabaseProperty): boolean
	for _, tag in property.Tags do
		if SKIP_TAGS[tag] then
			return true
		end
	end

	return false
end

local function encodePropertyKey(key: string): string
	if not string.match(key, "^[%w_]+$") then
		return `'{key:gsub("'", "''")}'`
	end
	return key
end

local function cacheDefaultMetadata(entry: PropertyEntry, defaultValue: any)
	entry.defaultValue = defaultValue

	local valueType = typeof(defaultValue)
	if valueType == "CFrame" then
		entry.defaultCFrameComponents = { defaultValue:GetComponents() }
	elseif valueType == "EnumItem" then
		entry.defaultEnumName = defaultValue.Name
	end
end

local function buildClassCache(className: string): ClassCache
	local cached = classCache[className]
	if cached then
		return cached
	end

	local db = roblox.getReflectionDatabase()
	local merged: { [string]: roblox.DatabaseProperty } = {}
	local chain = {}

	local current = db:GetClass(className)
	while current do
		table.insert(chain, 1, current)
		current = if current.Superclass then db:GetClass(current.Superclass) else nil
	end

	for _, class in chain do
		for name, property in class.Properties do
			merged[name] = property
		end
	end

	local rawEntries: { PropertyEntry } = {}
	for name, property in merged do
		if SKIP_PROPERTIES[name] or shouldSkipProperty(property) then
			continue
		end

		table.insert(rawEntries, {
			name = name,
			datatype = property.Datatype,
			encodedKey = encodePropertyKey(name),
		})
	end

	table.sort(rawEntries, function(left: PropertyEntry, right: PropertyEntry): boolean
		return left.name < right.name
	end)

	local entries: { PropertyEntry } = {}
	local ok, instance = pcall(function()
		return roblox.Instance.new(className)
	end)

	if ok then
		local object = instance :: any
		for _, entry in rawEntries do
			local readOk, value = pcall(function()
				return object[entry.name]
			end)

			if readOk then
				cacheDefaultMetadata(entry, value)
				table.insert(entries, entry)
			end
		end
	else
		for _, entry in rawEntries do
			table.insert(entries, entry)
		end
	end

	cached = {
		entries = entries,
	}
	classCache[className] = cached
	return cached
end

local function isEmptyRawValue(value: any): boolean
	return value == nil
end

local function isEmptyDumpValue(dumpValue: any): boolean
	if dumpValue == nil then
		return true
	end

	if type(dumpValue) == "table" and #dumpValue == 5 and dumpValue[1] == nil then
		return true
	end

	return false
end

local function equalsDefault(value: any, entry: PropertyEntry, full: boolean): boolean
	if full then
		return false
	end

	local defaultValue = entry.defaultValue
	if defaultValue == nil then
		return false
	end

	if value == defaultValue then
		return true
	end

	local valueType = typeof(value)
	if valueType == "number" and typeof(defaultValue) == "number" then
		return math.abs(value - defaultValue) < 1e-6
	end

	if valueType == "boolean" or valueType == "string" then
		return false
	end

	if valueType == "EnumItem" and entry.defaultEnumName then
		return value.Name == entry.defaultEnumName
	end

	if valueType == "Vector3" and typeof(defaultValue) == "Vector3" then
		return value.X == defaultValue.X and value.Y == defaultValue.Y and value.Z == defaultValue.Z
	end

	if valueType == "Vector2" and typeof(defaultValue) == "Vector2" then
		return value.X == defaultValue.X and value.Y == defaultValue.Y
	end

	if valueType == "Color3" and typeof(defaultValue) == "Color3" then
		return value.R == defaultValue.R and value.G == defaultValue.G and value.B == defaultValue.B
	end

	if valueType == "CFrame" and entry.defaultCFrameComponents then
		local components = entry.defaultCFrameComponents
		local x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22 = value:GetComponents()
		return x == components[1]
			and y == components[2]
			and z == components[3]
			and r00 == components[4]
			and r01 == components[5]
			and r02 == components[6]
			and r10 == components[7]
			and r11 == components[8]
			and r12 == components[9]
			and r20 == components[10]
			and r21 == components[11]
			and r22 == components[12]
	end

	return Values.equals(value, defaultValue)
end

local function formatNumber(value: number): string
	if value == math.floor(value) then
		return tostring(value)
	end

	return string.format("%.6g", value)
end

local function appendInlineDumpValue(dumpValue: any): string?
	local valueType = type(dumpValue)
	if valueType == "boolean" then
		return tostring(dumpValue)
	end

	if valueType == "number" then
		return formatNumber(dumpValue)
	end

	if valueType == "string" then
		if dumpValue == "" then
			return '""'
		end

		if string.match(dumpValue, "^[%w_%.:/<>@(),-]+$") then
			return dumpValue
		end

		if not string.find(dumpValue, "\n", 1, true) then
			return `"` .. dumpValue:gsub('"', '\\"') .. `"`
		end

		return nil
	end

	if valueType == "table" then
		local parts = table.create(#dumpValue)
		for index, item in dumpValue do
			local rendered = appendInlineDumpValue(item)
			if rendered == nil then
				return nil
			end
			parts[index] = rendered
		end
		return "[" .. table.concat(parts, ", ") .. "]"
	end

	return tostring(dumpValue)
end

local function toInlineString(dumpValue: any, writer: PropertyWriter, valueIndentLevel: number): string
	local rendered = appendInlineDumpValue(dumpValue)
	if rendered ~= nil then
		return rendered
	end

	local buf = StringBuffer.new(64)
	writer.appendScalarValue(buf, dumpValue, valueIndentLevel)
	return StringBuffer.finish(buf)
end

local function appendCFrameLine(
	buf: StringBuffer.StringBuffer,
	valueIndent: string,
	encodedKey: string,
	value: CFrame
): ()
	local x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22 = value:GetComponents()
	StringBuffer.append(buf, valueIndent)
	StringBuffer.append(buf, encodedKey)
	StringBuffer.append(buf, ": [")
	StringBuffer.append(buf, formatNumber(x))
	StringBuffer.append(buf, ", ")
	StringBuffer.append(buf, formatNumber(y))
	StringBuffer.append(buf, ", ")
	StringBuffer.append(buf, formatNumber(z))
	StringBuffer.append(buf, ", ")
	StringBuffer.append(buf, formatNumber(r00))
	StringBuffer.append(buf, ", ")
	StringBuffer.append(buf, formatNumber(r01))
	StringBuffer.append(buf, ", ")
	StringBuffer.append(buf, formatNumber(r02))
	StringBuffer.append(buf, ", ")
	StringBuffer.append(buf, formatNumber(r10))
	StringBuffer.append(buf, ", ")
	StringBuffer.append(buf, formatNumber(r11))
	StringBuffer.append(buf, ", ")
	StringBuffer.append(buf, formatNumber(r12))
	StringBuffer.append(buf, ", ")
	StringBuffer.append(buf, formatNumber(r20))
	StringBuffer.append(buf, ", ")
	StringBuffer.append(buf, formatNumber(r21))
	StringBuffer.append(buf, ", ")
	StringBuffer.append(buf, formatNumber(r22))
	StringBuffer.append(buf, "]\n")
end

local function forEachOutputProperty(
	instance: Instance,
	options: PropertyOptions,
	onProperty: (entry: PropertyEntry, dumpValue: any) -> (),
	profile: PropertyProfile?
)
	local cache = buildClassCache(instance.ClassName)
	local object = instance :: any
	local context = options.propertyContext

	for _, entry in cache.entries do
		if options.excludedProperties[entry.name] then
			continue
		end

		local readStarted = if profile then os.clock() else 0
		local value = object[entry.name]
		if profile then
			profile.readsSeconds += os.clock() - readStarted
		end

		if isEmptyRawValue(value) then
			continue
		end

		local compareStarted = if profile then os.clock() else 0
		if equalsDefault(value, entry, options.full) then
			if profile then
				profile.compareSeconds += os.clock() - compareStarted
			end
			continue
		end
		if profile then
			profile.compareSeconds += os.clock() - compareStarted
		end

		local dumpValue
		if typeof(value) == "CFrame" then
			dumpValue = value
		else
			dumpValue = Values.toDumpValue(value, entry.datatype, context)
		end

		if isEmptyDumpValue(dumpValue) then
			continue
		end

		onProperty(entry, dumpValue)
	end
end

local BATCH_SIZE = 48

local function flushLineBatch(buf: StringBuffer.StringBuffer, batch: { string }, count: number): number
	if count > 0 then
		StringBuffer.append(buf, table.concat(batch, "", 1, count))
	end
	return 0
end

function Properties.appendToBuffer(
	buf: StringBuffer.StringBuffer,
	instance: Instance,
	options: PropertyOptions,
	propsIndent: string,
	valueIndent: string,
	writer: PropertyWriter,
	valueIndentLevel: number,
	profile: PropertyProfile?
): boolean
	if not options.includeProperties then
		return false
	end

	local wroteHeader = false
	local lineBatch = table.create(BATCH_SIZE)
	local lineBatchCount = 0

	forEachOutputProperty(instance, options, function(entry: PropertyEntry, dumpValue: any)
		local writeStarted = if profile then os.clock() else 0

		if not wroteHeader then
			lineBatchCount = flushLineBatch(buf, lineBatch, lineBatchCount)
			StringBuffer.append(buf, propsIndent)
			StringBuffer.append(buf, "props:\n")
			wroteHeader = true
		end

		if typeof(dumpValue) == "CFrame" then
			lineBatchCount = flushLineBatch(buf, lineBatch, lineBatchCount)
			appendCFrameLine(buf, valueIndent, entry.encodedKey, dumpValue)
		else
			lineBatchCount += 1
			lineBatch[lineBatchCount] = valueIndent
				.. entry.encodedKey
				.. ": "
				.. toInlineString(dumpValue, writer, valueIndentLevel)
				.. "\n"
			if lineBatchCount >= BATCH_SIZE then
				lineBatchCount = flushLineBatch(buf, lineBatch, lineBatchCount)
			end
		end

		if profile then
			profile.writeSeconds += os.clock() - writeStarted
		end
	end, profile)

	if wroteHeader then
		lineBatchCount = flushLineBatch(buf, lineBatch, lineBatchCount)
	end

	return wroteHeader
end

function Properties.newProfile(): PropertyProfile
	return {
		readsSeconds = 0,
		compareSeconds = 0,
		writeSeconds = 0,
	}
end

return Properties
