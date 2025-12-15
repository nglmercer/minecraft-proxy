
export interface Packet {
    size: number;
    id: number;
    data: any;
}

export interface Protocol {
    /**
     * Attempts to parse a single packet from the buffer.
     * Returns the packet if successful, or null if more data is needed.
     * Throws error if data is invalid for this protocol.
     */
    parse(buffer: Uint8Array): Packet | null;
}
