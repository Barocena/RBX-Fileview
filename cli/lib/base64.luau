-- Adapted from https://github.com/daily3014/rbx-cryptography (MIT)

local PADDING_CHARACTER = 61
local ALPHABET_BYTES = buffer.create(64) do
	local Characters = {
		65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
		81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
		97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112,
		113, 114, 115, 116, 117, 118, 119, 120, 121, 122,
		48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
		43, 47,
	}

	for Index = 1, 64 do
		buffer.writeu8(ALPHABET_BYTES, Index - 1, Characters[Index])
	end
end

local ENCODE_A, ENCODE_B = buffer.create(131072), buffer.create(131072) do
	for Byte0 = 0, 255 do
		local Sextet0 = Byte0 // 4
		local Sextet0Char = buffer.readu8(ALPHABET_BYTES, Sextet0)
		local Byte0Low = Byte0 % 4
		for Byte1 = 0, 255 do
			local Sextet1 = Byte0Low * 16 + (Byte1 // 16)
			local Index = (Byte0 + Byte1 * 256) * 2
			buffer.writeu16(ENCODE_A, Index, Sextet0Char + buffer.readu8(ALPHABET_BYTES, Sextet1) * 256)
		end
	end

	for Byte1 = 0, 255 do
		local Nibble = (Byte1 % 16) * 4
		for Byte2 = 0, 255 do
			local Sextet2 = Nibble + (Byte2 // 64)
			local Sextet3 = Byte2 % 64
			local Index = (Byte1 + Byte2 * 256) * 2
			buffer.writeu16(ENCODE_B, Index, buffer.readu8(ALPHABET_BYTES, Sextet2) + buffer.readu8(ALPHABET_BYTES, Sextet3) * 256)
		end
	end
end

local function encodeBuffer(input: buffer): buffer
	local inputLength = buffer.len(input)
	if inputLength == 0 then
		return buffer.create(0)
	end

	local output = buffer.create(((inputLength + 2) // 3) * 4)
	local inputIndex = 0
	local outputIndex = 0
	local fullTripletEnd = inputLength - (inputLength % 3)
	local unrollStop = inputLength - 13

	local encodeA = ENCODE_A
	local encodeB = ENCODE_B
	local alphabetBytes = ALPHABET_BYTES

	while inputIndex <= unrollStop do
		local word0 = buffer.readu32(input, inputIndex)
		local word1 = buffer.readu32(input, inputIndex + 3)
		local word2 = buffer.readu32(input, inputIndex + 6)
		local word3 = buffer.readu32(input, inputIndex + 9)

		local keyA0 = word0 % 65536
		local keyB0 = (word0 // 256) % 65536
		buffer.writeu32(output, outputIndex, buffer.readu16(encodeA, keyA0 * 2) + buffer.readu16(encodeB, keyB0 * 2) * 0x10000)

		local keyA1 = word1 % 65536
		local keyB1 = (word1 // 256) % 65536
		buffer.writeu32(output, outputIndex + 4, buffer.readu16(encodeA, keyA1 * 2) + buffer.readu16(encodeB, keyB1 * 2) * 0x10000)

		local keyA2 = word2 % 65536
		local keyB2 = (word2 // 256) % 65536
		buffer.writeu32(output, outputIndex + 8, buffer.readu16(encodeA, keyA2 * 2) + buffer.readu16(encodeB, keyB2 * 2) * 0x10000)

		local keyA3 = word3 % 65536
		local keyB3 = (word3 // 256) % 65536
		buffer.writeu32(output, outputIndex + 12, buffer.readu16(encodeA, keyA3 * 2) + buffer.readu16(encodeB, keyB3 * 2) * 0x10000)

		inputIndex += 12
		outputIndex += 16
	end

	while inputIndex < fullTripletEnd do
		local keyA = buffer.readu16(input, inputIndex)
		local byte2 = buffer.readu8(input, inputIndex + 2)
		local keyB = (keyA // 256) + byte2 * 256
		buffer.writeu32(output, outputIndex, buffer.readu16(encodeA, keyA * 2) + buffer.readu16(encodeB, keyB * 2) * 0x10000)
		inputIndex += 3
		outputIndex += 4
	end

	local remainder = inputLength - inputIndex
	if remainder == 1 then
		local byte0 = buffer.readu8(input, inputIndex)
		local sextet0 = byte0 // 4
		local sextet1 = (byte0 % 4) * 16
		local pair = buffer.readu8(alphabetBytes, sextet0) + buffer.readu8(alphabetBytes, sextet1) * 256
		buffer.writeu16(output, outputIndex, pair)
		buffer.writeu8(output, outputIndex + 2, PADDING_CHARACTER)
		buffer.writeu8(output, outputIndex + 3, PADDING_CHARACTER)
	elseif remainder == 2 then
		local byte0 = buffer.readu8(input, inputIndex)
		local byte1 = buffer.readu8(input, inputIndex + 1)
		local keyA = byte0 + byte1 * 256
		buffer.writeu16(output, outputIndex, buffer.readu16(encodeA, keyA * 2))
		local sextet2 = (byte1 % 16) * 4
		buffer.writeu8(output, outputIndex + 2, buffer.readu8(alphabetBytes, sextet2))
		buffer.writeu8(output, outputIndex + 3, PADDING_CHARACTER)
	end

	return output
end

local Base64 = {}

function Base64.encode(data: string): string
	return buffer.tostring(encodeBuffer(buffer.fromstring(data)))
end

return Base64
