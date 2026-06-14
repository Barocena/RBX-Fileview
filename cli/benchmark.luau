local fs = require("@lune/fs")
local process = require("@lune/process")
local stdio = require("@lune/stdio")

local Dump = require("@self/dump")

export type BenchmarkOptions = {
	testDir: string,
	iterations: number,
	warmup: number,
	includeProperties: boolean,
	excludedProperties: { string },
	profile: boolean,
}

local ROBLOX_EXTENSIONS = {
	rbxl = true,
	rbxlx = true,
	rbxm = true,
	rbxmx = true,
}

local Benchmark = {}

local function printHelp()
	print("Usage: rbx-fileview benchmark [directory] [options]")
	print("")
	print("Benchmark dump performance for Roblox files in a directory.")
	print("Defaults to the Test/ folder when no directory is given.")
	print("")
	print("Options:")
	print("  --iterations <n>   Measured runs per file (default: 3)")
	print("  --warmup <n>       Warmup runs per file, not counted (default: 1)")
	print("  --no-properties    Instance structure only")
	print("  --exclude-property <names>  Exclude properties (comma-separated, repeatable)")
	print("  --profile          Print load/encode timings to stderr")
	print("  -h, --help         Show this help message")
end

local function appendExcludedProperties(target: { string }, value: string)
	for name in string.gmatch(value, "[^,]+") do
		local trimmed = (name:match("^%s*(.-)%s*$")) :: string
		if trimmed ~= "" then
			table.insert(target, trimmed)
		end
	end
end

local function parseArgs(args: { string }): BenchmarkOptions
	local options: BenchmarkOptions = {
		testDir = "Test",
		iterations = 3,
		warmup = 1,
		includeProperties = true,
		excludedProperties = {},
		profile = false,
	}

	local index = 1
	while index <= #args do
		local arg = args[index]

		if arg == "-h" or arg == "--help" then
			printHelp()
			process.exit(0)
		elseif arg == "--iterations" then
			index += 1
			local iterations = tonumber(args[index])
			if not iterations or iterations < 1 then
				error("Invalid value for --iterations")
			end
			options.iterations = math.floor(iterations)
		elseif arg == "--warmup" then
			index += 1
			local warmup = tonumber(args[index])
			if warmup == nil or warmup < 0 then
				error("Invalid value for --warmup")
			end
			options.warmup = math.floor(warmup)
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
			appendExcludedProperties(options.excludedProperties, propertyNames)
		elseif arg == "--profile" then
			options.profile = true
		elseif arg:sub(1, 1) == "-" then
			error(`Unknown option: {arg}`)
		else
			options.testDir = arg
		end

		index += 1
	end

	return options
end

local function isRobloxFile(fileName: string): boolean
	local extension = fileName:match("%.([%w]+)$")
	if not extension then
		return false
	end

	return ROBLOX_EXTENSIONS[extension:lower()] == true
end

local function listRobloxFiles(testDir: string): { string }
	if not fs.isDir(testDir) then
		error(`Directory not found: {testDir}`)
	end

	local files = {}
	for _, entry in fs.readDir(testDir) do
		if isRobloxFile(entry) then
			table.insert(files, entry)
		end
	end

	table.sort(files)
	return files
end

local function formatBytes(bytes: number): string
	if bytes < 1024 then
		return `{bytes} B`
	end

	if bytes < 1024 * 1024 then
		return `{string.format("%.1f", bytes / 1024)} KB`
	end

	return `{string.format("%.2f", bytes / (1024 * 1024))} MB`
end

local function formatMs(seconds: number): string
	return `{string.format("%.2f", seconds * 1000)} ms`
end

local function median(values: { number }): number
	local sorted = table.clone(values)
	table.sort(sorted)

	local count = #sorted
	if count == 0 then
		return 0
	end

	if count % 2 == 1 then
		return sorted[(count + 1) / 2]
	end

	local mid = count / 2
	return (sorted[mid] + sorted[mid + 1]) / 2
end

local function minValue(values: { number }): number
	local value = values[1]
	for index = 2, #values do
		if values[index] < value then
			value = values[index]
		end
	end
	return value
end

local function maxValue(values: { number }): number
	local value = values[1]
	for index = 2, #values do
		if values[index] > value then
			value = values[index]
		end
	end
	return value
end

local function padRight(text: string, width: number): string
	if #text >= width then
		return text
	end

	return text .. string.rep(" ", width - #text)
end

local function benchmarkFile(
	filePath: string,
	options: BenchmarkOptions
): {
	fileName: string,
	fileSize: number,
	instanceCount: number,
	outputBytes: number,
	minSeconds: number,
	medianSeconds: number,
	maxSeconds: number,
}
	local fileName = filePath:match("[^/\\]+$") or filePath
	local fileSize = #fs.readFile(filePath)
	local instanceCount = 0
	local outputBytes = 0
	local samples = table.create(options.iterations)
	local dumpOptions = {
		includeProperties = options.includeProperties,
		excludedProperties = options.excludedProperties,
		profile = options.profile,
	}

	for _ = 1, options.warmup do
		local result = Dump.dumpFile(filePath, dumpOptions)
		instanceCount = result.stats.instanceCount
		outputBytes = #result.output
	end

	for iteration = 1, options.iterations do
		local start = os.clock()
		local result = Dump.dumpFile(filePath, dumpOptions)
		local elapsed = os.clock() - start

		instanceCount = result.stats.instanceCount
		outputBytes = #result.output
		samples[iteration] = elapsed
	end

	return {
		fileName = fileName,
		fileSize = fileSize,
		instanceCount = instanceCount,
		outputBytes = outputBytes,
		minSeconds = minValue(samples),
		medianSeconds = median(samples),
		maxSeconds = maxValue(samples),
	}
end

function Benchmark.run(args: { string })
	local ok, result = pcall(function()
		return parseArgs(args)
	end)

	if not ok then
		stdio.ewrite(`Error: {result}\n`)
		stdio.ewrite("Run `rbx-fileview benchmark --help` for usage.\n")
		process.exit(1)
	end

	local options = result
	local files = listRobloxFiles(options.testDir)

	if #files == 0 then
		stdio.ewrite(`No Roblox files found in {options.testDir}\n`)
		process.exit(1)
	end

	print("RBX-Fileview dump benchmark")
	print(`Directory: {options.testDir}`)
	print(`Files: {#files} | warmup: {options.warmup} | iterations: {options.iterations}`)
	if not options.includeProperties then
		print("Mode: structure only (no properties)")
	elseif #options.excludedProperties > 0 then
		print(`Excluded properties: {#options.excludedProperties}`)
	end
	print("")

	local nameWidth = 24
	local sizeWidth = 10
	local instWidth = 8
	local outWidth = 10
	local timeWidth = 10

	for _, fileName in files do
		nameWidth = math.max(nameWidth, #fileName)
	end

	print(
		`{padRight("file", nameWidth)}  {padRight("size", sizeWidth)}  {padRight("inst", instWidth)}  {padRight(
			"out",
			outWidth
		)}  {padRight("min", timeWidth)}  {padRight("median", timeWidth)}  max`
	)
	print(string.rep("-", nameWidth + sizeWidth + instWidth + outWidth + timeWidth * 3 + 12))

	local totalMedian = 0

	for _, fileName in files do
		local filePath = `{options.testDir}/{fileName}`
		local row = benchmarkFile(filePath, options)
		totalMedian += row.medianSeconds

		print(
			`{padRight(row.fileName, nameWidth)}  {padRight(formatBytes(row.fileSize), sizeWidth)}  {padRight(
				tostring(row.instanceCount),
				instWidth
			)}  {padRight(formatBytes(row.outputBytes), outWidth)}  {padRight(formatMs(row.minSeconds), timeWidth)}  {padRight(
				formatMs(row.medianSeconds),
				timeWidth
			)}  {formatMs(row.maxSeconds)}`
		)
	end

	print(string.rep("-", nameWidth + sizeWidth + instWidth + outWidth + timeWidth * 3 + 12))
	print(`{padRight("TOTAL (median)", nameWidth + sizeWidth + instWidth + outWidth + 2)}  {formatMs(totalMedian)}`)
end

return Benchmark
