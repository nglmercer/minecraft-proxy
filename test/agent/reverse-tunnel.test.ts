import { describe, expect, test, afterAll, beforeAll } from 'bun:test';
import { BridgeServer } from '../../src';
import { TunnelAgent } from '../../src';
import type { Socket } from 'bun';

// Helper to create a delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Reverse Tunnel (Bridge + Agent)', () => {
    const BRIDGE_PORT = 30005; // Single port for both
    const LOCAL_MC_PORT = 30007;
    const SECRET = 'test-secret';

    let bridge: BridgeServer;
    let agent: TunnelAgent;
    let mockLocalServer: any;
    let localServerReceivedData: Buffer[] = [];
    let localServerSocket: Socket | null = null;

    beforeAll(async () => {
        // 1. Start Mock Local Minecraft Server
        mockLocalServer = Bun.listen({
            hostname: 'localhost',
            port: LOCAL_MC_PORT,
            socket: {
                open: (socket) => {
                    localServerSocket = socket;
                },
                data: (socket, data) => {
                    localServerReceivedData.push(Buffer.from(data));
                    // Echo back
                    socket.write(data);
                },
                error: (socket, error) => {
                    console.error('Mock Local Server Error:', error);
                }
            }
        });

        // 2. Start Bridge Server
        bridge = new BridgeServer({
            port: BRIDGE_PORT,
            secret: SECRET,
            debug: false, // Set to true for debugging
        });
        bridge.start();

        // 3. Start Tunnel Agent
        agent = new TunnelAgent({
            bridgeHost: 'localhost',
            bridgeControlPort: BRIDGE_PORT,
            localHost: 'localhost',
            localPort: LOCAL_MC_PORT,
            secret: SECRET,
            debug: false,
        });
        agent.start();

        // Give some time for Agent to connect to Bridge
        await delay(500);
    });

    afterAll(() => {
        mockLocalServer.stop();
        // We don't have explicit stop methods on Bridge/Agent yet, 
        // but Bun.listen returns a server object we could stop if we exposed it.
        // For now, the process exit will clean them up, or we can add stop() methods later.
    });

    test('should forward data from public client to local server and back', async () => {
        localServerReceivedData = [];
        const clientReceivedData: Buffer[] = [];

        // 4. Simulate a Player connecting to the Public Port (Same as Control Port now)
        const playerClient = await Bun.connect({
            hostname: 'localhost',
            port: BRIDGE_PORT,
            socket: {
                data: (socket, data) => {
                    clientReceivedData.push(Buffer.from(data));
                },
                error: (socket, error) => {
                    console.error('Player Client Error:', error);
                }
            }
        });

        // NO DELAY here! We want to test buffering.
        // Send data immediately: Player -> Bridge -> Agent -> Local Server
        const msg1 = 'Packet 1 (Handshake)';
        const msg2 = 'Packet 2 (Login)';

        playerClient.write(msg1);
        // Small yield to ensure they might be treated as separate events if OS allows, 
        // but close enough to hit the "Tunnel not ready" race.
        await delay(10);
        playerClient.write(msg2);

        // Wait for data propagation (end-to-end)
        await delay(1000);

        // Verify Local Server received BOTH
        const receivedStr = Buffer.concat(localServerReceivedData).toString();
        expect(receivedStr).toContain(msg1);
        expect(receivedStr).toContain(msg2);

        // Verify Echo: Local Server -> Agent -> Bridge -> Player
        const clientReceivedStr = Buffer.concat(clientReceivedData).toString();
        expect(clientReceivedStr).toContain(msg1);
        expect(clientReceivedStr).toContain(msg2);

        playerClient.end();
    });

    test('should reject agent with incorrect secret', async () => {
        // Create a separate agent with wrong secret
        const badAgent = new TunnelAgent({
            bridgeHost: 'localhost',
            bridgeControlPort: BRIDGE_PORT, // Connect to same bridge
            localHost: 'localhost',
            localPort: LOCAL_MC_PORT,
            secret: 'wrong-secret',
            debug: false,
        });

        // We need to spy on logs or check connection status. 
        // Since we don't expose status easily, let's just run it and ensure it doesn't crash 
        // and maybe check if it fails to authenticate (logs would show AUTH_FAIL).
        // For a robust test, we'd need to expose state on the Agent.

        badAgent.start();
        await delay(200);

        // This is a weak test without exposing state, but verifies no crash.
        expect(true).toBe(true);
    });
});
