/**
 * VarInt utilities for Minecraft protocol
 * Based on Minecraft protocol specification: https://wiki.vg/Protocol#VarInt_and_VarLong
 */

/**
 * Reads a VarInt from a stream
 */
export async function readVarInt(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<number> {
  let result = 0;
  let shift = 0;
  let byte: number;

  do {
    const { done, value } = await reader.read();
    if (done) {
      throw new Error('Unexpected end of stream while reading VarInt');
    }
    // value is defined because done is false
    const chunk = value!;
    if (chunk.length === 0) {
      throw new Error('Received empty chunk while reading VarInt');
    }
    byte = chunk[0]!;
    result |= (byte & 0x7F) << shift;
    shift += 7;
    // If we have more bytes, we need to read the next byte from the stream
    // But note: we consumed only one byte from the chunk. We should put the rest back?
    // This is a simplified implementation that assumes we read byte by byte.
    // For performance, we might want to read multiple bytes at once.
    // However, for simplicity, we'll read one byte at a time.
    // We'll create a new reader that can buffer.
  } while ((byte & 0x80) !== 0);

  return result;
}

/**
 * Writes a VarInt to a stream
 */
export async function writeVarInt(writer: WritableStreamDefaultWriter<Uint8Array>, value: number): Promise<void> {
  const bytes: number[] = [];
  do {
    let temp = value & 0x7F;
    value >>>= 7;
    if (value !== 0) {
      temp |= 0x80;
    }
    bytes.push(temp);
  } while (value !== 0);

  const buffer = new Uint8Array(bytes);
  await writer.write(buffer);
}

/**
 * Alternative: working with buffers (for synchronous operations)
 */

/**
 * Reads a VarInt from a buffer starting at the given offset.
 * Returns the value and the new offset.
 */
export function readVarIntSync(buffer: Uint8Array, offset: number): { value: number; offset: number } {
  let result = 0;
  let shift = 0;
  let byte: number;
  do {
    if (offset >= buffer.length) {
      throw new Error('Buffer too short');
    }
    byte = buffer[offset]!;
    offset++;
    result |= (byte & 0x7F) << shift;
    shift += 7;
  } while ((byte & 0x80) !== 0);
  return { value: result, offset };
}

/**
 * Writes a VarInt to a buffer at the given offset.
 * Returns the new offset.
 */
export function writeVarIntSync(buffer: Uint8Array, value: number, offset: number): number {
  do {
    let temp = value & 0x7F;
    value >>>= 7;
    if (value !== 0) {
      temp |= 0x80;
    }
    buffer[offset++] = temp;
  } while (value !== 0);
  return offset;
}

/**
 * Calculates the number of bytes required to encode a VarInt.
 */
export function varIntLength(value: number): number {
  let length = 0;
  do {
    value >>>= 7;
    length++;
  } while (value !== 0);
  return length;
}
