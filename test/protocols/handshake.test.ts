import { describe, expect, test } from 'bun:test';
import { parseHandshake } from '../../src/core/handshake.js';
import { writeVarIntSync } from '../../src/core/varint.js';

describe('Handshake', () => {
  test('parseHandshake - minimal handshake', () => {
    // Create a handshake packet:
    // Packet length: 15 (VarInt: 0x0F) because the packet is 15 bytes
    // Packet ID: 0 (VarInt: 0x00)
    // Protocol version: 47 (VarInt: 0x2F)
    // Server address: "localhost" (length: 9, string: "localhost")
    // Server port: 25565 (0x63DD)
    // Next state: 1 (VarInt: 0x01)
    // The packet (without length field) is 15 bytes:
    //   1 (packet ID) + 1 (protocol) + 10 (string: 1 byte length + 9 bytes) + 2 (port) + 1 (next state) = 15
    const buffer = new Uint8Array([
      0x0f,                               // Packet length (15)
      0x00,                               // Packet ID (0)
      0x2f,                               // Protocol version (47)
      0x09,                               // String length (9)
      0x6c, 0x6f, 0x63, 0x61, 0x6c, 0x68, 0x6f, 0x73, 0x74, // "localhost"
      0x63, 0xdd,                         // Port (25565)
      0x01,                               // Next state (1)
    ]);

    const result = parseHandshake(buffer);
    expect(result.handshake.packetLength).toBe(15);
    expect(result.handshake.packetId).toBe(0);
    expect(result.handshake.protocolVersion).toBe(47);
    expect(result.handshake.serverAddress).toBe('localhost');
    expect(result.handshake.serverPort).toBe(25565);
    expect(result.handshake.nextState).toBe(1);
    expect(result.bytesRead).toBe(16); // 1 (packet length) + 15 (packet)
  });

  test('parseHandshake - with longer address', () => {
    // Build a handshake with a longer address
    const address = 'mc.example.com';
    const addressBytes = new TextEncoder().encode(address);
    // Packet length (without the length field) = 
    //   1 (packet ID) + 1 (protocol) + (1 + addressBytes.length) (string) + 2 (port) + 1 (next state)
    const packetLength = 1 + 1 + 1 + addressBytes.length + 2 + 1;
    // Total buffer size = packetLength + varIntLength(packetLength)
    const buffer = new Uint8Array(packetLength + varIntLength(packetLength));
    let offset = 0;

    // Write packet length (VarInt) using the module's function
    offset = writeVarIntSync(buffer, packetLength, offset);
    // Packet ID
    offset = writeVarIntSync(buffer, 0x00, offset);
    // Protocol version
    offset = writeVarIntSync(buffer, 47, offset);
    // String length and string
    offset = writeVarIntSync(buffer, addressBytes.length, offset);
    buffer.set(addressBytes, offset);
    offset += addressBytes.length;
    // Port
    buffer[offset++] = 0x63; // 0x63DD = 25565
    buffer[offset++] = 0xdd;
    // Next state
    offset = writeVarIntSync(buffer, 2, offset);

    const result = parseHandshake(buffer);
    expect(result.handshake.serverAddress).toBe(address);
    expect(result.handshake.serverPort).toBe(25565);
    expect(result.handshake.nextState).toBe(2);
    // Verify that the bytes read match the buffer length
    expect(result.bytesRead).toBe(buffer.length);
  });

  test('parseHandshake - invalid packet ID throws', () => {
    const buffer = new Uint8Array([
      0x0e, 0x01, // Packet length 14, packet ID 1 (invalid for handshake)
      0x2f, 0x09, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0x68, 0x6f, 0x73, 0x74, 0x63, 0xdd, 0x01,
    ]);
    expect(() => parseHandshake(buffer)).toThrow();
  });
});

// Helper function
function varIntLength(value: number): number {
  let length = 0;
  do {
    value >>>= 7;
    length++;
  } while (value !== 0);
  return length;
}
