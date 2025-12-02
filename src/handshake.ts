import { readVarIntSync } from './varint.js';

export interface Handshake {
  packetLength: number;
  packetId: number;
  protocolVersion: number;
  serverAddress: string;
  serverPort: number;
  nextState: number;
}

/**
 * Parses a Minecraft handshake packet from a buffer.
 * Assumes the buffer contains the entire handshake packet starting at offset 0.
 * Returns the parsed handshake and the total bytes consumed.
 */
export function parseHandshake(buffer: Uint8Array): { handshake: Handshake; bytesRead: number } {
  let offset = 0;

  // Read packet length (VarInt)
  const packetLengthResult = readVarIntSync(buffer, offset);
  const packetLength = packetLengthResult.value;
  offset = packetLengthResult.offset;

  // Read packet ID (VarInt) - should be 0x00 for handshake
  const packetIdResult = readVarIntSync(buffer, offset);
  const packetId = packetIdResult.value;
  offset = packetIdResult.offset;

  if (packetId !== 0x00) {
    throw new Error(`Expected packet ID 0x00 for handshake, got ${packetId}`);
  }

  // Read protocol version (VarInt)
  const protocolVersionResult = readVarIntSync(buffer, offset);
  const protocolVersion = protocolVersionResult.value;
  offset = protocolVersionResult.offset;

  // Read server address (string)
  const addressLengthResult = readVarIntSync(buffer, offset);
  const addressLength = addressLengthResult.value;
  offset = addressLengthResult.offset;

  const serverAddress = new TextDecoder().decode(buffer.slice(offset, offset + addressLength));
  offset += addressLength;

  // Read server port (unsigned short, 2 bytes, big-endian)
  const serverPort = (buffer[offset]! << 8) | buffer[offset + 1]!;
  offset += 2;

  // Read next state (VarInt)
  const nextStateResult = readVarIntSync(buffer, offset);
  const nextState = nextStateResult.value;
  offset = nextStateResult.offset;

  // Verify that we read exactly the packet length (excluding the packet length field itself)
  const expectedBytes = packetLength + varIntLength(packetLength);
  if (offset !== expectedBytes) {
    throw new Error(`Parsed ${offset} bytes but expected ${expectedBytes} for packet length ${packetLength}`);
  }

  return {
    handshake: {
      packetLength,
      packetId,
      protocolVersion,
      serverAddress,
      serverPort,
      nextState,
    },
    bytesRead: offset,
  };
}

/**
 * Helper to calculate VarInt length (same as in varint.ts but exported)
 */
function varIntLength(value: number): number {
  let length = 0;
  do {
    value >>>= 7;
    length++;
  } while (value !== 0);
  return length;
}
