local InstanceOrder = {}

local ZERO_UNIQUE_ID = "00000000000000000000000000000000"

type ChildSortEntry = {
	instance: Instance,
	name: string,
	className: string,
	uniqueId: string,
	fileOrder: number,
}

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

export type DuplicateMetadata = { [number]: { index: number, total: number } }

local function siblingLabelKey(name: string, className: string): string
	return name .. "\0" .. className
end

function InstanceOrder.prepareChildren(children: { Instance }): DuplicateMetadata
	local count = #children
	if count <= 1 then
		return {}
	end

	local labelCounts: { [string]: number } = {}
	local hasDuplicates = false

	for index = 1, count do
		local child = children[index]
		local labelKey = siblingLabelKey(child.Name, child.ClassName)
		local total = (labelCounts[labelKey] or 0) + 1
		labelCounts[labelKey] = total
		if total > 1 then
			hasDuplicates = true
		end
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
		}
	end

	for index = 1, count do
		local entry = entries[index]
		if (labelCounts[siblingLabelKey(entry.name, entry.className)] or 0) > 1 then
			entry.uniqueId = readUniqueIdString(entry.instance)
		end
	end

	table.sort(entries, compareSortEntries)

	local duplicateMetadata: DuplicateMetadata = {}
	local duplicateIndexes: { [string]: number } = {}

	for index = 1, count do
		local entry = entries[index]
		children[index] = entry.instance

		local total = labelCounts[siblingLabelKey(entry.name, entry.className)] or 0
		if total > 1 then
			local labelKey = siblingLabelKey(entry.name, entry.className)
			local nextIndex = (duplicateIndexes[labelKey] or 0) + 1
			duplicateIndexes[labelKey] = nextIndex
			duplicateMetadata[index] = {
				index = nextIndex,
				total = total,
			}
		end
	end

	return duplicateMetadata
end

return InstanceOrder
