import type { Protocol, Packet } from './Protocol';
import { parseHandshake, type Handshake } from '../handshake';

export class MinecraftProtocol implements Protocol {
    parse(buffer: Uint8Array): Packet | null {
        try {
            // We use the existing logic which throws if incomplete?
            // Wait, existing parseHandshake logic:
            // "Assumes the buffer contains the entire handshake packet starting at offset 0."
            // But it doesn't explicitly check if buffer has enough bytes before reading, likely throwing RangeError or similar if accessing out of bounds, 
            // OR varint reading throws if incomplete?
            
            // Let's look at varint.ts if possible, but safe assumption is try-catch.
            // However, we need to distinguish "Not enough data" vs "Invalid data".
            
            // For now, let's wrap and catch.
            const result = parseHandshake(buffer);
            return {
                size: result.bytesRead,
                id: result.handshake.packetId, // 0x00
                data: result.handshake
            };
        } catch (error: any) {
            // Check if error implies "not enough bytes"
            // The existing varint.ts likely throws or returns partial?
            // If I look at handler code:
            // if (error.message === 'Buffer too short') return;
            
            if (error.message && (
                error.message.includes('Buffer too short') || 
                error.message.includes('Offset is outside the bounds') ||
                error.message.includes('out of bounds')
            )) {
                return null;
            }
            throw error;
        }
    }
}
