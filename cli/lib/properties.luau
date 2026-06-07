local roblox = require("@lune/roblox")
local Values = require("./values")

export type PropertyOptions = {
	full: boolean,
	includeProperties: boolean,
	includeSource: boolean,
	pathMap: { [Instance]: string },
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

local classPropertyCache: { [string]: { [string]: roblox.DatabaseProperty } } = {}
local runtimeDefaultCache: { [string]: { [string]: any } } = {}

local function getClassProperties(className: string): { [string]: roblox.DatabaseProperty }
	if classPropertyCache[className] then
		return classPropertyCache[className]
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

	classPropertyCache[className] = merged
	return merged
end

local function getRuntimeDefaults(className: string): { [string]: any }
	if runtimeDefaultCache[className] then
		return runtimeDefaultCache[className]
	end

	local db = roblox.getReflectionDatabase()
	if not db:GetClass(className) then
		return {}
	end

	local defaults: { [string]: any } = {}
	local ok, instance = pcall(function()
		return roblox.Instance.new(className)
	end)

	if not ok then
		runtimeDefaultCache[className] = defaults
		return defaults
	end

	for propertyName in getClassProperties(className) do
		local readOk, value = pcall(function()
			return (instance :: any)[propertyName]
		end)

		if readOk then
			defaults[propertyName] = value
		end
	end

	runtimeDefaultCache[className] = defaults
	return defaults
end

local function shouldSkipProperty(property: roblox.DatabaseProperty): boolean
	for _, tag in property.Tags do
		if SKIP_TAGS[tag] then
			return true
		end
	end

	return false
end

local function readProperty(instance: Instance, propertyName: string): (boolean, any)
	local object = instance :: any
	local ok, value = pcall(function()
		return object[propertyName]
	end)

	return ok, value
end

local function isEmptyValue(value: any, serialized: any): boolean
	if value == nil then
		return true
	end

	if type(serialized) == "table" and serialized.type == "Ref" and serialized.value == nil then
		return true
	end

	if type(serialized) == "table" and serialized.type == "PhysicalProperties" then
		return serialized.density == nil
	end

	return false
end

function Properties.collect(instance: Instance, options: PropertyOptions): { [string]: any }
	if not options.includeProperties then
		return {}
	end

	local properties = getClassProperties(instance.ClassName)
	local defaults = getRuntimeDefaults(instance.ClassName)
	local collected: { [string]: any } = {}
	local context: Values.SerializeContext = {
		pathMap = options.pathMap,
		full = options.full,
	}

	for propertyName, property in properties do
		if SKIP_PROPERTIES[propertyName] or shouldSkipProperty(property) then
			continue
		end

		if not options.includeSource and propertyName == "Source" then
			continue
		end

		local ok, value = readProperty(instance, propertyName)
		if not ok or isEmptyValue(value, value) then
			continue
		end

		local defaultValue = defaults[propertyName]
		if not options.full and defaultValue ~= nil and Values.equals(value, defaultValue) then
			continue
		end

		local serialized = Values.serialize(value, property.Datatype, context)
		if serialized == nil or isEmptyValue(value, serialized) then
			continue
		end

		collected[propertyName] = serialized
	end

	return collected
end

function Properties.sortKeys(properties: { [string]: any }): { string }
	local keys = {}
	for key in properties do
		table.insert(keys, key)
	end
	table.sort(keys)
	return keys
end

return Properties
