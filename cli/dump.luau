local fs = require("@lune/fs")
local process = require("@lune/process")
local stdio = require("@lune/stdio")
local Load = require("@self/lib/load")
local Tree = require("@self/lib/tree")
local YamlFormat = require("@self/lib/format/yaml")

export type DumpRunOptions = {
	full: boolean?,
	includeProperties: boolean?,
	excludedProperties: { string }?,
	maxDepth: number?,
}

export type DumpCliOptions = DumpRunOptions & {
	filePath: string?,
	outputPath: string?,
	stats: boolean,
	excludedPropertiesExplicit: boolean?,
}

export type DumpResult = {
	output: string,
	stats: Tree.TreeStats,
}

local Dump = {}

local DEFAULT_EXCLUDED_PROPERTIES: { string } = {}
local DEFAULT_RUN_OPTIONS: DumpRunOptions = {
	full = false,
	includeProperties = true,
	excludedProperties = DEFAULT_EXCLUDED_PROPERTIES,
	maxDepth = nil,
}

local function buildExcludedPropertySet(names: { string }): { [string]: boolean }
	local set: { [string]: boolean } = {}

	for _, name in names do
		set[name] = true
	end

	return set
end

local function appendExcludedProperties(target: { string }, value: string)
	for name in string.gmatch(value, "[^,]+") do
		local trimmed = (name:match("^%s*(.-)%s*$")) :: string
		if trimmed ~= "" then
			table.insert(target, trimmed)
		end
	end
end

local function resolveExcludedProperties(options: DumpRunOptions?): { string }
	if options and options.excludedProperties ~= nil then
		return options.excludedProperties
	end

	return DEFAULT_EXCLUDED_PROPERTIES
end

local function resolveRunOptions(options: DumpRunOptions?): DumpRunOptions
	return {
		full = options and options.full ~= nil and options.full or DEFAULT_RUN_OPTIONS.full,

		includeProperties = options and options.includeProperties ~= nil and options.includeProperties
			or DEFAULT_RUN_OPTIONS.includeProperties,

		excludedProperties = resolveExcludedProperties(options),
		maxDepth = if options then options.maxDepth else DEFAULT_RUN_OPTIONS.maxDepth,
	}
end

function Dump.dumpFile(filePath: string, options: DumpRunOptions?): DumpResult
	local runOptions = resolveRunOptions(options)

	local loaded = Load.loadFile(filePath)

	local treeOptions: Tree.TreeOptions = {
		full = runOptions.full :: boolean,
		includeProperties = runOptions.includeProperties :: boolean,
		excludedProperties = buildExcludedPropertySet(runOptions.excludedProperties :: { string }),
		maxDepth = runOptions.maxDepth,
	}

	local treeResult

	if loaded.kind == "place" then
		treeResult = Tree.buildPlace(loaded.root, treeOptions)
	else
		treeResult = Tree.buildModel(loaded.roots, treeOptions)
	end

	return {
		output = YamlFormat.encode(treeResult),
		stats = treeResult.stats,
	}
end

local function printHelp()
	print(`Usage: rbx-fileview dump <file> [options]`)
	print("")
	print("Options:")
	print("  -o, --output <path>     Write output to file (default: stdout)")
	print("  --include-default-properties  Include properties at their default values")
	print("  --max-depth <n>         Limit traversal depth")
	print("  --no-properties         Instance structure only")
	print("  --exclude-property <names>  Exclude properties from output (comma-separated, repeatable)")
	print("  --stats                 Print instance counts to stderr")
	print("  -h, --help              Show this help message")
end

local function parseArgs(args: { string }): DumpCliOptions
	local options: DumpCliOptions = {
		filePath = nil,
		outputPath = nil,
		full = false,
		includeProperties = true,
		excludedProperties = {},
		maxDepth = nil,
		stats = false,
		excludedPropertiesExplicit = false,
	}

	local index = 1

	while index <= #args do
		local arg = args[index]

		if arg == "-h" or arg == "--help" then
			printHelp()
			process.exit(0)
		elseif arg == "-o" or arg == "--output" then
			index += 1
			options.outputPath = args[index]
			if not options.outputPath then
				error("Missing value for --output")
			end
		elseif arg == "--include-default-properties" or arg == "--full" then
			options.full = true
		elseif arg == "--max-depth" then
			index += 1
			local depth = tonumber(args[index])
			if not depth or depth < 0 then
				error("Invalid value for --max-depth")
			end
			options.maxDepth = depth
		elseif arg == "--properties" then
			error("The --properties option was removed. Properties are included by default; use --no-properties to omit them.")
		elseif arg == "--no-properties" then
			options.includeProperties = false
		elseif arg == "--exclude-property" then
			index += 1
			local propertyNames = args[index]
			if not propertyNames or propertyNames == "" then
				error("Missing value for --exclude-property")
			end
			appendExcludedProperties(options.excludedProperties :: { string }, propertyNames)
			options.excludedPropertiesExplicit = true
		elseif arg == "--no-excluded-properties" then
			error(
				"The --no-excluded-properties option was removed. All properties are included by default; use --exclude-property to omit specific properties."
			)
		elseif arg == "--stats" then
			options.stats = true
		elseif arg == "--format" then
			error("The --format option was removed. rbx-fileview dump output is YAML only.")
		elseif arg:sub(1, 1) == "-" then
			error(`Unknown option: {arg}`)
		else
			if options.filePath then
				error(`Unexpected argument: {arg}`)
			end
			options.filePath = arg
		end

		index += 1
	end

	if not options.filePath then
		error("Missing required file path")
	end

	if not options.excludedPropertiesExplicit then
		options.excludedProperties = table.clone(DEFAULT_EXCLUDED_PROPERTIES)
	end

	return options
end

function Dump.run(args: { string })
	local ok, result = pcall(function()
		return parseArgs(args)
	end)

	if not ok then
		stdio.ewrite(`Error: {result}\n`)
		stdio.ewrite("Run `rbx-fileview dump --help` for usage.\n")
		process.exit(1)
	end

	local options = result
	local dumpResult = Dump.dumpFile(options.filePath :: string, options)

	if options.stats then
		stdio.ewrite(`Instances: {dumpResult.stats.instanceCount}, max depth: {dumpResult.stats.maxDepthReached}\n`)
	end

	local output = dumpResult.output

	if options.outputPath then
		fs.writeFile(options.outputPath, output)
	else
		print(output)
	end
end

return Dump
