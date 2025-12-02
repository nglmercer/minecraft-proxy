import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { ConnectionHandler } from '../src/connection-handler.js';
import { writeVarIntSync } from '../src/varint.js';

// Helper to create a mock socket
function createMockSocket() {
    let dataHandler: Function | undefined;
    let closeHandler: Function | undefined;
    let errorHandler: Function | undefined;

    return {
        remoteAddress: '127.0.0.1',
        remotePort: 12345,
        readyState: 'open',
        end: mock(),
        write: mock(),
        get data() { return dataHandler; },
        set data(handler: Function | undefined) { dataHandler = handler; },
        get close() { return closeHandler; },
        set close(handler: Function | undefined) { closeHandler = handler; },
        get error() { return errorHandler; },
        set error(handler: Function | undefined) { errorHandler = handler; },
        // Helpers
        triggerData(data: Buffer | Uint8Array) {
            if (dataHandler) dataHandler(data);
        },
        triggerClose() {
            if (closeHandler) closeHandler();
        },
        triggerError(error: Error) {
            if (errorHandler) errorHandler(error);
        },
    };
}

describe('ConnectionHandler', () => {
    let handler: ConnectionHandler;
    let mockConnect: ReturnType<typeof mock>;
    let mockClient: any;
    let mockBackend: any;

    beforeEach(() => {
        mockBackend = createMockSocket();
        mockConnect = mock((options: any) => {
            // Simulate successful connection
            if (options.socket && options.socket.open) {
                options.socket.open(mockBackend);
            }
            return Promise.resolve(mockBackend);
        });

        handler = new ConnectionHandler(
            {
                listenPort: 25565,
                backendHost: 'backend.example.com',
                backendPort: 25565,
                debug: false,
            },
            mockConnect as any
        );

        mockClient = createMockSocket();
    });

    test('should connect to backend after receiving valid handshake', () => {
        handler.handleConnection(mockClient);

        // Construct a valid handshake packet
        // Packet Length + Packet ID (0x00) + Protocol Version + Server Address + Server Port + Next State
        // Let's make a simple one.
        // Protocol Version: 763 (1.20.1) -> VarInt
        // Server Address: "localhost" -> String (VarInt length + bytes)
        // Server Port: 25565 -> UShort (2 bytes)
        // Next State: 1 (Status) -> VarInt

        const protocolVersion = 763;
        const serverAddress = 'localhost';
        const serverPort = 25565;
        const nextState = 1;

        const buffer = new Uint8Array(1024);
        let offset = 0;

        // We need to calculate packet length first, but it's easier to write body then prepend length.
        // Body starts at offset 0 for now (we'll shift it later or just write to a separate buffer)
        const bodyBuffer = new Uint8Array(1024);
        let bodyOffset = 0;

        bodyOffset = writeVarIntSync(bodyBuffer, 0x00, bodyOffset); // Packet ID
        bodyOffset = writeVarIntSync(bodyBuffer, protocolVersion, bodyOffset);

        // String: length + bytes
        const addressBytes = new TextEncoder().encode(serverAddress);
        bodyOffset = writeVarIntSync(bodyBuffer, addressBytes.length, bodyOffset);
        bodyBuffer.set(addressBytes, bodyOffset);
        bodyOffset += addressBytes.length;

        // Port: 2 bytes big endian
        bodyBuffer[bodyOffset++] = (serverPort >> 8) & 0xFF;
        bodyBuffer[bodyOffset++] = serverPort & 0xFF;

        bodyOffset = writeVarIntSync(bodyBuffer, nextState, bodyOffset);

        // Now write length + body
        offset = writeVarIntSync(buffer, bodyOffset, offset);
        buffer.set(bodyBuffer.slice(0, bodyOffset), offset);
        offset += bodyOffset;

        const handshakePacket = buffer.slice(0, offset);

        // Send handshake
        mockClient.triggerData(handshakePacket);

        // Verify connection to backend
        expect(mockConnect).toHaveBeenCalled();
        const connectArgs = mockConnect.mock.calls[0][0];
        expect(connectArgs.hostname).toBe('backend.example.com');
        expect(connectArgs.port).toBe(25565);

        // Verify handshake forwarded to backend
        expect(mockBackend.write).toHaveBeenCalledWith(handshakePacket);
    });

    test('should wait for more data if handshake is incomplete', () => {
        handler.handleConnection(mockClient);

        // Send just the packet length (assuming it's small enough to be 1 byte)
        // But we need to send at least something that looks like a VarInt
        const buffer = new Uint8Array([0x05]); // Length 5
        mockClient.triggerData(buffer);

        // Should NOT connect yet
        expect(mockConnect).not.toHaveBeenCalled();

        // Send more data (but still not enough)
        mockClient.triggerData(new Uint8Array([0x00])); // Packet ID

        expect(mockConnect).not.toHaveBeenCalled();
    });

    test('should close connection on invalid handshake (wrong packet ID)', () => {
        handler.handleConnection(mockClient);

        // Packet Length: 1, Packet ID: 0x01 (Ping, not Handshake)
        const buffer = new Uint8Array([0x01, 0x01]);
        mockClient.triggerData(buffer);

        expect(mockConnect).not.toHaveBeenCalled();
        expect(mockClient.end).toHaveBeenCalled();
    });
});
