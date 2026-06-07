local roblox = require("@lune/roblox")
local Values = require("./values")

export type PropertyOptions = {
	full: boolean,
	includeProperties: boolean,
	includeSource: boolean,
	pathMap: { [Instance]: string },
}

export type CollectedProperties = {
	props: { [string]: any },
	propKeys: { string },
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

type PropertyEntry = {
	name: string,
	datatype: string,
}

type ClassCache = {
	entries: { PropertyEntry },
	defaults: { [string]: any },
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

	local entries: { PropertyEntry } = {}
	for name, property in merged do
		if SKIP_PROPERTIES[name] or shouldSkipProperty(property) then
			continue
		end

		table.insert(entries, {
			name = name,
			datatype = property.Datatype,
		})
	end

	table.sort(entries, function(left: PropertyEntry, right: PropertyEntry): boolean
		return left.name < right.name
	end)

	local defaults: { [string]: any } = {}
	local readableEntries: { PropertyEntry } = {}
	local ok, instance = pcall(function()
		return roblox.Instance.new(className)
	end)

	if ok then
		local object = instance :: any
		for _, entry in entries do
			local readOk, value = pcall(function()
				return object[entry.name]
			end)

			if readOk then
				defaults[entry.name] = value
				table.insert(readableEntries, entry)
			end
		end
	else
		readableEntries = entries
	end

	cached = {
		entries = readableEntries,
		defaults = defaults,
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

function Properties.collect(instance: Instance, options: PropertyOptions): CollectedProperties?
	if not options.includeProperties then
		return nil
	end

	local cache = buildClassCache(instance.ClassName)
	local object = instance :: any
	local props: { [string]: any } = {}
	local propKeys: { string } = {}
	local context: Values.SerializeContext = {
		pathMap = options.pathMap,
		full = options.full,
	}

	for _, entry in cache.entries do
		if not options.includeSource and entry.name == "Source" then
			continue
		end

		local readOk, value = pcall(function()
			return object[entry.name]
		end)

		if not readOk or isEmptyRawValue(value) then
			continue
		end

		local defaultValue = cache.defaults[entry.name]
		if not options.full and defaultValue ~= nil and Values.equals(value, defaultValue) then
			continue
		end

		local dumpValue = Values.toDumpValue(value, entry.datatype, context)
		if isEmptyDumpValue(dumpValue) then
			continue
		end

		table.insert(propKeys, entry.name)
		props[entry.name] = dumpValue
	end

	if #propKeys == 0 then
		return nil
	end

	return {
		props = props,
		propKeys = propKeys,
	}
end

return Properties
