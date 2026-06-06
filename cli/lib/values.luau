local serde = require("@lune/serde")

export type SerializeContext = {
	pathMap: { [Instance]: string },
	full: boolean,
}

local Values = {}

local BINARY_HASH_THRESHOLD = 256

local function isInstance(value: any): boolean
	return typeof(value) == "Instance" or (type(value) == "userdata" and value.IsA ~= nil and value:IsA("Instance"))
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

function Values.serialize(value: any, datatype: string, context: SerializeContext): any
	if value == nil then
		return nil
	end

	if typeof(value) == "boolean" or typeof(value) == "number" then
		return value
	end

	if typeof(value) == "string" then
		if datatype == "BinaryString" then
			if #value > BINARY_HASH_THRESHOLD then
				return {
					type = "BinaryString",
					encoding = "hash",
					value = serde.hash("sha256", value),
					size = #value,
				}
			end

			return {
				type = "BinaryString",
				encoding = "base64",
				value = encodeBase64(value),
			}
		end

		if datatype == "Content" or datatype == "ContentId" then
			return {
				type = "Content",
				uri = value,
			}
		end

		return value
	end

	if typeof(value) == "Vector3" then
		return {
			type = "Vector3",
			x = value.X,
			y = value.Y,
			z = value.Z,
		}
	end

	if typeof(value) == "Vector2" then
		return {
			type = "Vector2",
			x = value.X,
			y = value.Y,
		}
	end

	if typeof(value) == "Color3" then
		return {
			type = "Color3",
			r = value.R,
			g = value.G,
			b = value.B,
		}
	end

	if typeof(value) == "UDim" then
		return {
			type = "UDim",
			scale = value.Scale,
			offset = value.Offset,
		}
	end

	if typeof(value) == "UDim2" then
		return {
			type = "UDim2",
			x = Values.serialize(value.X, "UDim", context),
			y = Values.serialize(value.Y, "UDim", context),
		}
	end

	if typeof(value) == "CFrame" then
		local x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22 = value:GetComponents()
		return {
			type = "CFrame",
			position = { x, y, z },
			orientation = { r00, r01, r02, r10, r11, r12, r20, r21, r22 },
		}
	end

	if typeof(value) == "EnumItem" then
		return {
			type = "Enum",
			enum = tostring(value.EnumType),
			value = value.Name,
		}
	end

	if typeof(value) == "BrickColor" then
		return {
			type = "BrickColor",
			name = value.Name,
			number = value.Number,
		}
	end

	if typeof(value) == "NumberRange" then
		return {
			type = "NumberRange",
			min = value.Min,
			max = value.Max,
		}
	end

	if typeof(value) == "NumberSequence" then
		local keypoints = {}
		for _, keypoint in value.Keypoints do
			table.insert(keypoints, {
				time = keypoint.Time,
				value = keypoint.Value,
				envelope = keypoint.Envelope,
			})
		end
		return {
			type = "NumberSequence",
			keypoints = keypoints,
		}
	end

	if typeof(value) == "ColorSequence" then
		local keypoints = {}
		for _, keypoint in value.Keypoints do
			table.insert(keypoints, {
				time = keypoint.Time,
				color = Values.serialize(keypoint.Value, "Color3", context),
			})
		end
		return {
			type = "ColorSequence",
			keypoints = keypoints,
		}
	end

	if typeof(value) == "Rect" then
		return {
			type = "Rect",
			min = Values.serialize(value.Min, "Vector2", context),
			max = Values.serialize(value.Max, "Vector2", context),
		}
	end

	if typeof(value) == "PhysicalProperties" then
		return {
			type = "PhysicalProperties",
			density = value.Density,
			friction = value.Friction,
			elasticity = value.Elasticity,
			frictionWeight = value.FrictionWeight,
			elasticityWeight = value.ElasticityWeight,
		}
	end

	if isInstance(value) then
		local path = context.pathMap[value]
		if path then
			return {
				type = "Instance",
				path = path,
			}
		end

		local fullName = value:GetFullName()
		if fullName == "" or fullName == "Game" then
			path = "/"
		elseif fullName:sub(1, 5) == "Game." then
			path = "/" .. fullName:sub(6):gsub("%.", "/")
		else
			path = "/" .. fullName:gsub("%.", "/")
		end

		return {
			type = "Instance",
			path = path,
		}
	end

	if typeof(value) == "buffer" then
		local data = buffer.tostring(value)
		if #data > BINARY_HASH_THRESHOLD then
			return {
				type = "BinaryString",
				encoding = "hash",
				value = serde.hash("sha256", data),
				size = #data,
			}
		end

		return {
			type = "BinaryString",
			encoding = "base64",
			value = encodeBase64(data),
		}
	end

	if type(value) == "table" then
		local items = {}
		for index, item in value do
			items[index] = Values.serialize(item, datatype, context)
		end
		return {
			type = datatype,
			value = items,
		}
	end

	return {
		type = datatype,
		value = tostring(value),
	}
end

return Values
