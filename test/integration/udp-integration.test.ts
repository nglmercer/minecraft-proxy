import { describe, expect, test, afterAll } from 'bun:test';
import { ProxyServer } from '../src/ProxyServer';
import { PassthroughProtocol } from '../src/protocols/PassthroughProtocol';

describe('UDP Integration Test', () => {
    const BACKEND_PORT = 31001;
    const PROXY_PORT = 31002;

    let backendSocket: any;
    let proxyServer: ProxyServer;
    let clientSocket: any;

    afterAll(() => {
         if (backendSocket) backendSocket.close();
         if (proxyServer) proxyServer.stop();
         if (clientSocket) clientSocket.close();
    });

    test('should proxy data between client and backend over UDP', async () => {
        // 1. Fake Backend
        const backendMessages: string[] = [];
        backendSocket = await Bun.udpSocket({
            port: BACKEND_PORT,
            socket: {
                data(socket, data, port, addr) {
                    console.log(`[Backend] Received from ${addr}:${port}: ${data.toString()}`);
                    backendMessages.push(data.toString());
                    // Echo back
                    socket.send("Hello UDP Client", port, addr);
                }
            }
        });

        // 2. Start Proxy with Passthrough Protocol
        // We need to pass the protocol instance
        const protocol = new PassthroughProtocol();
        proxyServer = new ProxyServer({
             proxyPort: PROXY_PORT,
             minecraftHost: '127.0.0.1',
             minecraftPort: BACKEND_PORT,
             transportType: 'udp',
             debug: true
        }, protocol);
        
        await proxyServer.start();

        // 3. Client
        const clientMessages: string[] = [];
        clientSocket = await Bun.udpSocket({
             socket: {
                 data(socket, data) {
                     console.log(`[Client] Received: ${data.toString()}`);
                     clientMessages.push(data.toString());
                 }
             }
        });

        // 4. Send Message from Client to Proxy
        const msg = "Hello UDP Proxy";
        await clientSocket.send(Buffer.from(msg), PROXY_PORT, '127.0.0.1');

        // 5. Wait
        await new Promise(resolve => setTimeout(resolve, 500));

        // 6. Verify
        expect(backendMessages.length).toBeGreaterThan(0);
        expect(backendMessages[0]).toBe(msg);
        
        expect(clientMessages.length).toBeGreaterThan(0);
        expect(clientMessages[0]).toBe("Hello UDP Client");
    });
});
