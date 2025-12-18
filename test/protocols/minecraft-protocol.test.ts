import { describe, expect, test } from 'bun:test';
import { MinecraftProtocol, writeVarIntSync } from '../../src';
describe('MinecraftProtocol', () => {
    test('should parse a valid handshake packet', () => {
        const protocol = new MinecraftProtocol();
        
        // Construct handshake
        const protocolVersion = 763;
        const serverAddress = 'localhost';
        const serverPort = 25565;
        const nextState = 1;

        const buffer = new Uint8Array(1024);
        let offset = 0;
        const bodyBuffer = new Uint8Array(1024);
        let bodyOffset = 0;

        bodyOffset = writeVarIntSync(bodyBuffer, 0x00, bodyOffset); // Packet ID
        bodyOffset = writeVarIntSync(bodyBuffer, protocolVersion, bodyOffset);

        const addressBytes = new TextEncoder().encode(serverAddress);
        bodyOffset = writeVarIntSync(bodyBuffer, addressBytes.length, bodyOffset);
        bodyBuffer.set(addressBytes, bodyOffset);
        bodyOffset += addressBytes.length;

        bodyBuffer[bodyOffset++] = (serverPort >> 8) & 0xFF;
        bodyBuffer[bodyOffset++] = serverPort & 0xFF;

        bodyOffset = writeVarIntSync(bodyBuffer, nextState, bodyOffset);

        offset = writeVarIntSync(buffer, bodyOffset, offset);
        buffer.set(bodyBuffer.slice(0, bodyOffset), offset);
        offset += bodyOffset;

        const packetData = buffer.slice(0, offset);
        
        const result = protocol.parse(packetData);
        expect(result).not.toBeNull();
        expect(result!.id).toBe(0x00);
        expect(result!.data).toEqual({
            packetLength: bodyOffset,
            packetId: 0x00,
            protocolVersion,
            serverAddress,
            serverPort,
            nextState
        });
        expect(result!.size).toBe(offset);
    });

    test('should return null for incomplete packet', () => {
        const protocol = new MinecraftProtocol();
        const buffer = new Uint8Array([0x05, 0x00]); // Length 5, ID 0, but no more data
        const result = protocol.parse(buffer);
        expect(result).toBeNull();
    });

    test('should throw error for invalid packet ID', () => {
        const protocol = new MinecraftProtocol();
        // Length 1, ID 0x01 (invalid for handshake)
        const buffer = new Uint8Array([0x01, 0x01]);
        expect(() => protocol.parse(buffer)).toThrow();
    });
});
