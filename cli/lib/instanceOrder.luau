local InstanceOrder = {}

local ZERO_UNIQUE_ID = "00000000000000000000000000000000"

type ChildSortEntry = {
	instance: Instance,
	name: string,
	className: string,
	uniqueId: string,
	fileOrder: number,
	duplicateTotal: number,
}

type LabelCountMap = { [string]: { [string]: number } }

local function readUniqueIdString(instance: Instance): string
	local uid = (instance :: any).UniqueId
	if typeof(uid) ~= "UniqueId" then
		return ""
	end

	local id = tostring(uid)
	if id == ZERO_UNIQUE_ID then
		return ""
	end

	return id
end

local function compareSortEntries(a: ChildSortEntry, b: ChildSortEntry): boolean
	if a.name ~= b.name then
		return a.name < b.name
	end

	if a.className ~= b.className then
		return a.className < b.className
	end

	if a.uniqueId ~= "" and b.uniqueId ~= "" and a.uniqueId ~= b.uniqueId then
		return a.uniqueId < b.uniqueId
	end

	return a.fileOrder < b.fileOrder
end

local function getLabelCount(labelCounts: LabelCountMap, name: string, className: string): number
	local byClass = labelCounts[name]
	if not byClass then
		return 0
	end

	return byClass[className] or 0
end

local function incrementLabelCount(labelCounts: LabelCountMap, name: string, className: string)
	local byClass = labelCounts[name]
	if not byClass then
		byClass = {}
		labelCounts[name] = byClass
	end

	byClass[className] = (byClass[className] or 0) + 1
end

export type DuplicateMetadata = { [number]: { index: number, total: number } }

function InstanceOrder.prepareChildren(children: { Instance }): DuplicateMetadata
	local count = #children
	if count <= 1 then
		return {}
	end

	if count == 2 then
		local first = children[1]
		local second = children[2]
		if first.Name ~= second.Name or first.ClassName ~= second.ClassName then
			return {}
		end
	end

	local labelCounts: LabelCountMap = {}
	local hasDuplicates = false

	for index = 1, count do
		local child = children[index]
		local name = child.Name
		local className = child.ClassName

		if getLabelCount(labelCounts, name, className) > 0 then
			hasDuplicates = true
		end

		incrementLabelCount(labelCounts, name, className)
	end

	if not hasDuplicates then
		return {}
	end

	local entries = table.create(count)

	for index = 1, count do
		local child = children[index]
		local name = child.Name
		local className = child.ClassName

		entries[index] = {
			instance = child,
			name = name,
			className = className,
			uniqueId = "",
			fileOrder = index,
			duplicateTotal = getLabelCount(labelCounts, name, className),
		}
	end

	for index = 1, count do
		local entry = entries[index]
		if entry.duplicateTotal > 1 then
			entry.uniqueId = readUniqueIdString(entry.instance)
		end
	end

	table.sort(entries, compareSortEntries)

	local duplicateMetadata: DuplicateMetadata = {}
	local duplicateIndexes: LabelCountMap = {}

	for index = 1, count do
		local entry = entries[index]
		children[index] = entry.instance

		if entry.duplicateTotal > 1 then
			local nextIndex = getLabelCount(duplicateIndexes, entry.name, entry.className) + 1
			incrementLabelCount(duplicateIndexes, entry.name, entry.className)
			duplicateMetadata[index] = {
				index = nextIndex,
				total = entry.duplicateTotal,
			}
		end
	end

	return duplicateMetadata
end

return InstanceOrder
