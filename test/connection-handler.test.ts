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
                proxyPort: 25566,
                minecraftHost: 'backend.example.com',
                minecraftPort: 25565,
                debug: false,
            },
            mockConnect as any
        );

        mockClient = createMockSocket();
    });

    test('should connect to backend after receiving valid handshake', () => {
        // handler.handleConnection(mockClient); // No longer needed

        // Construct a valid handshake packet
        // ... (omitted for brevity, same construction logic)
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

        const handshakePacket = buffer.slice(0, offset);

        // Send handshake
        handler.handleClientData(mockClient, handshakePacket as any); // Cast because Buffer vs Uint8Array

        // Verify connection to backend
        expect(mockConnect).toHaveBeenCalled();
        const connectArgs = mockConnect.mock.calls[0]![0];
        expect(connectArgs.hostname).toBe('backend.example.com');
        expect(connectArgs.port).toBe(25565);

        // Verify handshake forwarded to backend
        expect(mockBackend.write).toHaveBeenCalledWith(handshakePacket);
    });

    test('should wait for more data if handshake is incomplete', () => {
        // Send just the packet length
        const buffer = new Uint8Array([0x05]); // Length 5
        handler.handleClientData(mockClient, buffer as any);

        // Should NOT connect yet
        expect(mockConnect).not.toHaveBeenCalled();

        // Send more data (but still not enough)
        handler.handleClientData(mockClient, new Uint8Array([0x00]) as any); // Packet ID

        expect(mockConnect).not.toHaveBeenCalled();
    });

    test('should close connection on invalid handshake (wrong packet ID)', () => {
        // Packet Length: 1, Packet ID: 0x01 (Ping, not Handshake)
        const buffer = new Uint8Array([0x01, 0x01]);
        handler.handleClientData(mockClient, buffer as any);

        expect(mockConnect).not.toHaveBeenCalled();
        expect(mockClient.end).toHaveBeenCalled();
    });
});
