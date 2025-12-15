import type { Protocol, Packet } from './Protocol';

export class PassthroughProtocol implements Protocol {
    parse(buffer: Uint8Array): Packet | null {
        if (buffer.length === 0) return null;
        return {
            id: 0, // Generic ID
            size: buffer.length,
            data: Buffer.from(buffer) // Copy data
        };
    }
}
