import { describe, expect, test, afterAll } from 'bun:test';
import { startProxy } from '../src/proxy.js';
import { writeVarIntSync } from '../src/varint.js';

describe('Integration Test (Real TCP Sockets)', () => {
    const BACKEND_PORT = 30001;
    const PROXY_PORT = 30002;

    let backendServer: any;
    let proxyServer: any;

    // Cleanup after tests
    afterAll(() => {
        if (backendServer) backendServer.stop();
        if (proxyServer) proxyServer.stop();
    });

    test('should proxy data between client and backend over real TCP sockets', async () => {
        // 1. Start a "Fake" Minecraft Backend
        const backendReceivedData: Buffer[] = [];
        backendServer = Bun.listen({
            hostname: 'localhost',
            port: BACKEND_PORT,
            socket: {
                data(socket, data) {
                    backendReceivedData.push(Buffer.from(data));
                    // Echo back modified data to prove bidirectional communication
                    socket.write(Buffer.from('Hello from Backend!'));
                },
            },
        });

        // 2. Start the Proxy
        proxyServer = await startProxy({
            listenPort: PROXY_PORT,
            backendHost: 'localhost',
            backendPort: BACKEND_PORT,
            debug: true,
        });

        // 3. Start a Client
        const clientReceivedData: Buffer[] = [];
        const client = await Bun.connect({
            hostname: 'localhost',
            port: PROXY_PORT,
            socket: {
                data(socket, data) {
                    clientReceivedData.push(Buffer.from(data));
                },
            },
        });

        // 4. Send Valid Handshake from Client
        // We need a valid handshake for the proxy to initiate connection to backend
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
        client.write(handshakePacket);

        // 5. Wait for data exchange
        // We need to wait a bit for async network operations
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('Backend received bytes:', Buffer.concat(backendReceivedData).length);
        console.log('Client received bytes:', Buffer.concat(clientReceivedData).length);

        // 6. Verify Backend received the handshake
        expect(backendReceivedData.length).toBeGreaterThan(0);
        // The first chunk received by backend should be the handshake
        // Note: TCP might fragment or combine, but for localhost small packet it's usually one
        const receivedHandshake = Buffer.concat(backendReceivedData);
        expect(receivedHandshake.equals(handshakePacket)).toBe(true);

        // 7. Verify Client received the response from Backend
        expect(clientReceivedData.length).toBeGreaterThan(0);
        const receivedResponse = Buffer.concat(clientReceivedData).toString();
        expect(receivedResponse).toBe('Hello from Backend!');

        // Cleanup client
        client.end();
    });
});
