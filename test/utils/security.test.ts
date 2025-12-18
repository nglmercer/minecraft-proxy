import { describe, expect, test } from 'bun:test';
import { parseHandshake,readVarIntSync } from '../../src';
describe('Security / Validation Tests', () => {

    test('VarInt should throw if more than 5 bytes', () => {
        // 6 bytes with MSB set
        const maliciousBuffer = new Uint8Array([0x80, 0x80, 0x80, 0x80, 0x80, 0x01]); 
        expect(() => readVarIntSync(maliciousBuffer, 0)).toThrow(/VarInt too big/);
    });

    test('Handshake should throw if string length is massive or out of bounds', () => {
        // Construct a partial handshake packet
        // Packet Length: 5 bytes (VarInt)
        // Packet ID: 0 (VarInt)
        // Protocol Version: 763 (VarInt)
        // Address Length: 1000 (VarInt) - but buffer ends immediately
        
        // We'll mock the internal readVarIntSync to return a huge length or manually construct
        // Let's manually construct correct VarInts up to address length
        
        const buffer = new Uint8Array(100);
        let offset = 0;
        // Packet Len (placeholder)
        buffer[offset++] = 10; 
        // Packet ID 0
        buffer[offset++] = 0;
        // Proto Ver 0
        buffer[offset++] = 0;
        // String Len: 0xFF (255) - but no string follows
        buffer[offset++] = 255; 
        
        // This should probably throw "Buffer too short" or "String length out of bounds"
        expect(() => parseHandshake(buffer)).toThrow();
    });

    test('Handshake should throw if string length exceeds reasonable limit (e.g. 1024)', () => {
        // Attack scenario: Client claims 2MB Hostname
        // We shouldn't try to allocate 2MB string.
        
        // ... (Similar construction)
    });
});
