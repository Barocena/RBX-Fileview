export type StringBuffer = {
	buf: buffer,
	pos: number,
	cap: number,
}

local StringBuffer = {}

local DEFAULT_CAPACITY = 64 * 1024

function StringBuffer.new(initialCapacity: number?): StringBuffer
	local capacity = initialCapacity or DEFAULT_CAPACITY
	return {
		buf = buffer.create(capacity),
		pos = 0,
		cap = capacity,
	}
end

function StringBuffer.reserve(state: StringBuffer, additional: number): ()
	local needed = state.pos + additional
	if needed <= state.cap then
		return
	end

	local newCapacity = state.cap
	while newCapacity < needed do
		newCapacity *= 2
	end

	local newBuffer = buffer.create(newCapacity)
	if state.pos > 0 then
		buffer.writestring(newBuffer, 0, buffer.readstring(state.buf, 0, state.pos))
	end

	state.buf = newBuffer
	state.cap = newCapacity
end

function StringBuffer.append(state: StringBuffer, text: string): ()
	local length = #text
	StringBuffer.reserve(state, length)
	buffer.writestring(state.buf, state.pos, text)
	state.pos += length
end

function StringBuffer.finish(state: StringBuffer): string
	if state.pos == 0 then
		return ""
	end

	return buffer.readstring(state.buf, 0, state.pos)
end

return StringBuffer
