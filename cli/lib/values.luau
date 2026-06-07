local serde = require("@lune/serde")

export type SerializeContext = {
	pathMap: { [Instance]: string },
	full: boolean,
}

local Values = {}

local BINARY_HASH_THRESHOLD = 256

local function isInstance(value: any): boolean
	return typeof(value) == "Instance"
end

local function formatInstancePath(path: string): string
	if path == "/" then
		return ""
	end

	if path:sub(1, 1) == "/" then
		return path:sub(2)
	end

	return path
end

local function resolveInstancePath(value: Instance, context: SerializeContext): string
	local path = context.pathMap[value]
	if path then
		return formatInstancePath(path)
	end

	local fullName = value:GetFullName()
	if fullName == "" or fullName == "Game" then
		return ""
	end

	if fullName:sub(1, 5) == "Game." then
		return fullName:sub(6):gsub("%.", "/")
	end

	return fullName:gsub("%.", "/")
end

function Values.equals(a: any, b: any): boolean
	if a == b then
		return true
	end

	if typeof(a) ~= typeof(b) then
		return false
	end

	if typeof(a) == "number" then
		return math.abs(a - b) < 1e-6
	end

	if typeof(a) == "Vector3" or typeof(a) == "Vector2" then
		return a.X == b.X and a.Y == b.Y and (typeof(a) ~= "Vector3" or a.Z == b.Z)
	end

	if typeof(a) == "Color3" then
		return a.R == b.R and a.G == b.G and a.B == b.B
	end

	if typeof(a) == "UDim" then
		return a.Scale == b.Scale and a.Offset == b.Offset
	end

	if typeof(a) == "UDim2" then
		return Values.equals(a.X, b.X) and Values.equals(a.Y, b.Y)
	end

	if typeof(a) == "CFrame" then
		local ax, ay, az, bx, by, bz, cx, cy, cz, tx, ty, tz = a:GetComponents()
		local bx2, by2, bz2, b2x, b2y, b2z, c2x, c2y, c2z, t2x, t2y, t2z = b:GetComponents()
		return ax == bx2
			and ay == by2
			and az == bz2
			and bx == b2x
			and by == b2y
			and bz == b2z
			and cx == c2x
			and cy == c2y
			and cz == c2z
			and tx == t2x
			and ty == t2y
			and tz == t2z
	end

	if typeof(a) == "EnumItem" then
		return a.Name == b.Name and a.EnumType == b.EnumType
	end

	if typeof(a) == "BrickColor" then
		return a.Number == b.Number
	end

	if typeof(a) == "UniqueId" then
		return tostring(a) == tostring(b)
	end

	if typeof(a) == "buffer" then
		return false
	end

	if type(a) == "table" then
		if #a ~= #b then
			return false
		end

		for index, item in a do
			if not Values.equals(item, b[index]) then
				return false
			end
		end

		return true
	end

	return false
end

local function encodeBase64(data: string): string
	local alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	local output = table.create(math.ceil(#data / 3) * 4)
	local index = 1

	for i = 1, #data, 3 do
		local b1 = string.byte(data, i)
		local b2 = string.byte(data, i + 1) or 0
		local b3 = string.byte(data, i + 2) or 0

		local combined = bit32.lshift(b1, 16) + bit32.lshift(b2, 8) + b3

		output[index] = string.sub(alphabet, bit32.rshift(combined, 18) + 1, bit32.rshift(combined, 18) + 1)
		output[index + 1] = string.sub(alphabet, bit32.band(bit32.rshift(combined, 12), 63) + 1, bit32.band(bit32.rshift(combined, 12), 63) + 1)
		output[index + 2] = if i + 1 <= #data
			then string.sub(alphabet, bit32.band(bit32.rshift(combined, 6), 63) + 1, bit32.band(bit32.rshift(combined, 6), 63) + 1)
			else "="
		output[index + 3] = if i + 2 <= #data
			then string.sub(alphabet, bit32.band(combined, 63) + 1, bit32.band(combined, 63) + 1)
			else "="
		index += 4
	end

	return table.concat(output)
end

local function normalizeContentString(value: string): string
	local uri = string.match(value, "^Content%(Uri=(.+)%)$")
	if uri then
		return uri
	end

	if value == "Content()" or value == "Content" then
		return ""
	end

	return value
end

local function dumpContentValue(value: any): string
	if typeof(value) == "string" then
		return normalizeContentString(value)
	end

	local ok, uri = pcall(function()
		return (value :: any).Uri
	end)

	if ok and type(uri) == "string" and uri ~= "" then
		return uri
	end

	return normalizeContentString(tostring(value))
end

local function dumpBinaryData(data: string): any
	if #data > BINARY_HASH_THRESHOLD then
		return { #data, serde.hash("sha256", data) }
	end

	return encodeBase64(data)
end

function Values.toDumpValue(value: any, datatype: string, context: SerializeContext): any
	if value == nil then
		return nil
	end

	if typeof(value) == "boolean" or typeof(value) == "number" then
		return value
	end

	if typeof(value) == "string" then
		if datatype == "BinaryString" then
			return dumpBinaryData(value)
		end

		if datatype == "Content" or datatype == "ContentId" then
			return dumpContentValue(value)
		end

		if string.sub(value, 1, 8) == "Content(" then
			return normalizeContentString(value)
		end

		return value
	end

	if typeof(value) == "Content" then
		return dumpContentValue(value)
	end

	if typeof(value) == "Vector3" then
		return { value.X, value.Y, value.Z }
	end

	if typeof(value) == "Vector2" then
		return { value.X, value.Y }
	end

	if typeof(value) == "Color3" then
		return { value.R, value.G, value.B }
	end

	if typeof(value) == "UDim" then
		return { value.Scale, value.Offset }
	end

	if typeof(value) == "UDim2" then
		return {
			value.X.Scale,
			value.X.Offset,
			value.Y.Scale,
			value.Y.Offset,
		}
	end

	if typeof(value) == "CFrame" then
		local x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22 = value:GetComponents()
		return { x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22 }
	end

	if typeof(value) == "EnumItem" then
		return value.Name
	end

	if typeof(value) == "BrickColor" then
		return value.Number
	end

	if typeof(value) == "UniqueId" then
		return tostring(value)
	end

	if typeof(value) == "NumberRange" then
		return { value.Min, value.Max }
	end

	if typeof(value) == "NumberSequence" then
		local keypoints = table.create(#value.Keypoints)
		for index, keypoint in value.Keypoints do
			keypoints[index] = { keypoint.Time, keypoint.Value, keypoint.Envelope }
		end
		return keypoints
	end

	if typeof(value) == "ColorSequence" then
		local keypoints = table.create(#value.Keypoints)
		for index, keypoint in value.Keypoints do
			local color = keypoint.Value
			keypoints[index] = { keypoint.Time, color.R, color.G, color.B }
		end
		return keypoints
	end

	if typeof(value) == "Rect" then
		local min = value.Min
		local max = value.Max
		return { min.X, min.Y, max.X, max.Y }
	end

	if typeof(value) == "PhysicalProperties" then
		return {
			value.Density,
			value.Friction,
			value.Elasticity,
			value.FrictionWeight,
			value.ElasticityWeight,
		}
	end

	if isInstance(value) then
		return resolveInstancePath(value, context)
	end

	if typeof(value) == "buffer" then
		return dumpBinaryData(buffer.tostring(value))
	end

	if type(value) == "table" then
		local items = table.create(#value)
		for index, item in value do
			items[index] = Values.toDumpValue(item, datatype, context)
		end
		return items
	end

	local text = tostring(value)
	if string.sub(text, 1, 8) == "Content(" then
		return normalizeContentString(text)
	end

	return text
end

return Values
