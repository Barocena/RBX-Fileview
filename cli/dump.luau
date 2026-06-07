local fs = require("@lune/fs")
local process = require("@lune/process")
local stdio = require("@lune/stdio")

local Load = require("@self/lib/load")
local Tree = require("@self/lib/tree")
local YamlFormat = require("@self/lib/format/yaml")

export type DumpOptions = {
	filePath: string?,
	outputPath: string?,
	full: boolean,
	includeProperties: boolean,
	includeSource: boolean,
	maxDepth: number?,
	stats: boolean,
}

local Dump = {}

local function printHelp()
	print(`Usage: lupa dump <file> [options]`)
	print("")
	print("Options:")
	print("  -o, --output <path>     Write output to file (default: stdout)")
	print("  --full                  Include default-valued properties")
	print("  --max-depth <n>         Limit traversal depth")
	print("  --properties            Include properties (default)")
	print("  --no-properties         Instance structure only")
	print("  --no-source             Omit script Source property text")
	print("  --stats                 Print instance counts to stderr")
	print("  -h, --help              Show this help message")
end

local function parseArgs(args: { string }): DumpOptions
	local options: DumpOptions = {
		filePath = nil,
		outputPath = nil,
		full = false,
		includeProperties = true,
		includeSource = true,
		maxDepth = nil,
		stats = false,
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
		elseif arg == "--full" then
			options.full = true
		elseif arg == "--max-depth" then
			index += 1
			local depth = tonumber(args[index])
			if not depth or depth < 0 then
				error("Invalid value for --max-depth")
			end
			options.maxDepth = depth
		elseif arg == "--properties" then
			options.includeProperties = true
		elseif arg == "--no-properties" then
			options.includeProperties = false
		elseif arg == "--no-source" then
			options.includeSource = false
		elseif arg == "--stats" then
			options.stats = true
		elseif arg == "--format" then
			error("The --format option was removed. Lupa dump output is YAML only.")
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

	return options
end

function Dump.run(args: { string })
	local ok, result = pcall(function()
		return parseArgs(args)
	end)

	if not ok then
		stdio.ewrite(`Error: {result}\n`)
		stdio.ewrite("Run `lupa dump --help` for usage.\n")
		process.exit(1)
	end

	local options = result

	local loaded = Load.loadFile(options.filePath :: string)
	local treeOptions: Tree.TreeOptions = {
		full = options.full,
		includeProperties = options.includeProperties,
		includeSource = options.includeSource,
		maxDepth = options.maxDepth,
	}

	local treeResult
	if loaded.kind == "place" then
		treeResult = Tree.buildPlace(loaded.root, treeOptions)
	else
		treeResult = Tree.buildModel(loaded.roots, treeOptions)
	end

	local output = YamlFormat.encode(treeResult)

	if options.stats then
		stdio.ewrite(
			`Instances: {treeResult.stats.instanceCount}, max depth: {treeResult.stats.maxDepthReached}\n`
		)
	end

	if options.outputPath then
		fs.writeFile(options.outputPath, output)
	else
		print(output)
	end
end

return Dump
