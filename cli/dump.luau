local fs = require("@lune/fs")
local process = require("@lune/process")
local stdio = require("@lune/stdio")

local Load = require("@self/lib/load")
local Tree = require("@self/lib/tree")
local YamlFormat = require("@self/lib/format/yaml")
local TreeFormat = require("@self/lib/format/tree")

export type DumpOptions = {
	filePath: string?,
	outputPath: string?,
	format: "yaml" | "tree",
	full: boolean,
	includeProperties: boolean,
	maxDepth: number?,
	stats: boolean,
}

local Dump = {}

local function printHelp()
	print(`Usage: lupa dump <file> [options]`)
	print("")
	print("Options:")
	print("  -o, --output <path>     Write output to file (default: stdout)")
	print("  --format yaml|tree      Output format (default: yaml)")
	print("  --full                  Include default-valued properties")
	print("  --max-depth <n>         Limit traversal depth")
	print("  --properties            Include properties (default)")
	print("  --no-properties         Tree structure only")
	print("  --stats                 Print instance counts to stderr")
	print("  -h, --help              Show this help message")
end

local function parseArgs(args: { string }): DumpOptions
	local options: DumpOptions = {
		filePath = nil,
		outputPath = nil,
		format = "yaml",
		full = false,
		includeProperties = true,
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
		elseif arg == "--format" then
			index += 1
			local format = args[index]
			if format ~= "yaml" and format ~= "tree" then
				error(`Invalid format "{format}" (expected yaml or tree)`)
			end
			options.format = format
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
		elseif arg == "--stats" then
			options.stats = true
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
		maxDepth = options.maxDepth,
	}

	local treeResult
	if loaded.kind == "place" then
		treeResult = Tree.buildPlace(loaded.root, treeOptions)
	else
		treeResult = Tree.buildModel(loaded.roots, treeOptions)
	end

	local output
	if options.format == "yaml" then
		output = YamlFormat.encode(treeResult)
	else
		output = TreeFormat.encode(treeResult)
	end

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
