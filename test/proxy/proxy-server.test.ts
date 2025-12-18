import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { ProxyServer } from '../../src';
import type { Transport, Connection } from '../../src/transports/Transport';
import type { Protocol, Packet } from '../../src/protocols/Protocol';

// Mocks
class MockConnection implements Connection {
    public data: any = {};
    public onHandlers: Record<string, Function[]> = {};
    public writeMock = mock();
    public closeMock = mock();

    constructor(public remoteAddress = '127.0.0.1', public remotePort = 12345) {}

    write(data: Uint8Array): void {
        this.writeMock(data);
    }
    close(): void {
        this.closeMock();
        this.emit('close');
    }
    on(event: 'data' | 'close' | 'error', listener: (arg?: any) => void): void {
        if (!this.onHandlers[event]) this.onHandlers[event] = [];
        this.onHandlers[event].push(listener);
    }

    emit(event: string, ...args: any[]) {
        if (this.onHandlers[event]) {
            this.onHandlers[event].forEach(l => l(...args));
        }
    }
}

class MockTransport implements Transport {
    public listenMock = mock((...args: any[]) => Promise.resolve());
    public closeMock = mock();
    public onConnectionHandler: ((conn: Connection) => void) | null = null;

    listen(port: number, host?: string): Promise<void> {
        return this.listenMock(port, host);
    }
    onConnection(listener: (connection: Connection) => void): void {
        this.onConnectionHandler = listener;
    }
    close(): void {
        this.closeMock();
    }

    // Helper to simulate connection
    simulateConnection(conn: MockConnection) {
        if (this.onConnectionHandler) {
            this.onConnectionHandler(conn);
        }
    }
}

class MockProtocol implements Protocol {
    public parseMock = mock();
    parse(buffer: Uint8Array): Packet | null {
        return this.parseMock(buffer);
    }
}

describe('ProxyServer Unit Tests', () => {
    let proxy: ProxyServer;
    let transport: MockTransport;
    let protocol: MockProtocol;

    beforeEach(() => {
        // We'll need to inject the mock transport into ProxyServer.
        // Since ProxyServer creates transport internally based on config, 
        // we might need to subclass or modify ProxyServer to accept injected transport.
        // For this test, we can use "any" casting or modify constructor.
        
        // Let's modify ProxyServer slightly to allow transport injection or 
        // we can cheat by replacing the property after construction if we changed it to protected/public or use any.
        
        protocol = new MockProtocol();
        proxy = new ProxyServer({ debug: false }, protocol);
        
        transport = new MockTransport();
        // Force replace transport
        (proxy as any).transport = transport;
    });

    test('should start and listen on transport', async () => {
        await proxy.start();
        expect(transport.listenMock).toHaveBeenCalledTimes(1);
    });

    test('should close transport on stop', () => {
        proxy.stop();
        expect(transport.closeMock).toHaveBeenCalledTimes(1);
    });

    test('should handle client with valid handshake', async () => {
        await proxy.start();
        
        const client = new MockConnection('1.1.1.1', 80);
        transport.simulateConnection(client);
        
        // Mock protocol to return success on specific input
        const handshakeData = new Uint8Array([1, 2, 3]);
        protocol.parseMock.mockReturnValue({
            id: 0,
            size: 3,
            data: { some: 'handshake' }
        });

        // Mock Bun.connect for backend (ProxyServer calls Bun.connect / Bun.udpSocket directly)
        // This is the hard part - ProxyServer has direct Bun calls.
        // We should really refactor ProxyServer to use a "Connector" interface.
        // But for now, we can mock Bun.connect globally?
        // Bun.connect = mock(...) // This is risky in parallel tests.
        
        // Ideally, we refactor ProxyServer.ts to use a connector.
        // But let's verify buffering logic at least.
        
        // ... Wait, if we can't easily mock backend connection, we'll crash or fail.
        // ProxyServer:130 -> Bun.connect
        
        // Let's assume for this test we mock Bun.connect
        const oldConnect = Bun.connect;
        const mockBackend = new MockConnection('2.2.2.2', 25565);
        Bun.connect = mock(() => {
            // Return a promise resolving to a socket-like object
            return Promise.resolve({
                write: mockBackend.writeMock,
                end: mockBackend.closeMock,
                // We need to capture the callbacks passed to Bun.connect options
            } as any);
            // Actually Bun.connect takes options with `socket` handlers.
        }) as any;

        // But ProxyServer uses `socket: { open: ..., data: ... }`.
        // Bun.connect implementation in test runtime needs to simulate that too?
        // This suggests `ProxyServer` is too coupled to Bun global.
        
        // Plan: Just test that it PARSES content and TRIES to connect.
        // If Bun.connect is mocked to fail, it should close client.
        
        Bun.connect = mock(() => Promise.reject("Backend unavailable")) as any;
        
        client.emit('data', handshakeData);
        
        // Wait for async?
        await new Promise(r => setTimeout(r, 10));
        
        expect(protocol.parseMock).toHaveBeenCalled();
        expect(Bun.connect).toHaveBeenCalled(); // Tried to connect
        expect(client.closeMock).toHaveBeenCalled(); // Closed because backend failed
        
        // Restore
        Bun.connect = oldConnect;
    });

    test('should close client on handshake error', async () => {
        await proxy.start();
        const client = new MockConnection();
        transport.simulateConnection(client);
        
        protocol.parseMock.mockImplementation(() => {
            throw new Error('Invalid packet');
        });
        
        client.emit('data', new Uint8Array([0]));
        
        expect(client.closeMock).toHaveBeenCalled();
        // Should not try to connect
        // Note: Bun.connect might be called if we didn't mock/clean expectations? 
        // (Depends on if I restored it correctly above)
    });
});
