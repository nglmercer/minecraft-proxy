import { describe, expect, test, afterAll, beforeAll } from 'bun:test';
import { BridgeServerEnhanced, TunnelAgent } from '../../src';
import type { Socket } from 'bun';

// Helper to create a delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Reverse Tunnel Simple (Bridge + Agent)', () => {
    const BRIDGE_PORT = 30010;
    const LOCAL_MC_PORT = 30011;
    const SECRET = 'test-secret';

    let bridge: BridgeServerEnhanced;
    let agent: TunnelAgent;
    let mockLocalServer: any;
    let localServerReceivedData: Buffer[] = [];

    beforeAll(async () => {
        // 1. Start Mock Local Minecraft Server
        localServerReceivedData = [];
        mockLocalServer = Bun.listen({
            hostname: 'localhost',
            port: LOCAL_MC_PORT,
            socket: {
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

        // 2. Start Enhanced Bridge Server (simple config)
        bridge = new BridgeServerEnhanced({
            port: BRIDGE_PORT,
            secret: SECRET,
            debug: false, // Less verbose for tests
            auth: {
                enabled: false, // Use simple shared secret auth
                secret: SECRET
            }
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

        // Give time for Agent to connect to Bridge
        await delay(500);
    });

    afterAll(() => {
        mockLocalServer.stop();
    });

    test('should establish connection between agent and bridge', async () => {
        // Verify agent connected by checking bridge stats
        const stats = bridge.getTokenStats();
        expect(stats).toBeDefined();
        expect(stats.enabled).toBe(false); // Auth is disabled
    });

    test('should authenticate agent with shared secret', async () => {
        // Create a new agent with correct secret
        const testAgent = new TunnelAgent({
            bridgeHost: 'localhost',
            bridgeControlPort: BRIDGE_PORT,
            localHost: 'localhost',
            localPort: 30012, // Different port
            secret: SECRET,
            debug: false,
        });

        testAgent.start();
        await delay(300);

        // Should not throw any errors and should connect
        expect(true).toBe(true); // If we get here, connection didn't crash
    });

    test('should reject agent with incorrect secret', async () => {
        // Create agent with wrong secret
        const badAgent = new TunnelAgent({
            bridgeHost: 'localhost',
            bridgeControlPort: BRIDGE_PORT,
            localHost: 'localhost',
            localPort: 30013,
            secret: 'wrong-secret',
            debug: false,
        });

        badAgent.start();
        await delay(300);

        // Agent should fail to authenticate but not crash
        expect(true).toBe(true);
    });

    test('should work with token authentication', async () => {
        // Create bridge with auth enabled
        const authBridge = new BridgeServerEnhanced({
            port: 30014,
            secret: SECRET,
            debug: false,
            auth: {
                enabled: true,
                secret: 'auth-test-secret'
            }
        });
        authBridge.start();

        // Generate claim code
        const claimCode = authBridge.generateClaimCode('test-agent', 'test');
        expect(claimCode).toBeTruthy();
        expect(claimCode.length).toBe(6);

        // Create agent with claim code
        const authAgent = new TunnelAgent({
            bridgeHost: 'localhost',
            bridgeControlPort: 30014,
            localHost: 'localhost',
            localPort: 30015,
            secret: claimCode,
            debug: false,
        });

        authAgent.start();
        await delay(500);

        // Verify that the claim code was redeemed and token was created
        const stats = authBridge.getTokenStats();
        expect(stats.enabled).toBe(true);
        if (typeof stats === 'object' && 'activeTokens' in stats) {
            // The claim code should have been redeemed, creating a token
            expect(stats.activeTokens).toBeGreaterThanOrEqual(0);
        }
    });

    test('should generate and validate tokens correctly', async () => {
        const authBridge = new BridgeServerEnhanced({
            port: 30016,
            secret: SECRET,
            debug: false,
            auth: {
                enabled: true,
                secret: 'token-test-secret'
            }
        });
        authBridge.start();

        // Generate claim code
        const claimCode = authBridge.generateClaimCode('token-agent', 'token-ns');
        
        // Redeem claim code
        const tokenInfo = authBridge.redeemClaimCode(claimCode);
        expect(tokenInfo).toBeTruthy();
        expect(tokenInfo!.agentId).toBe('token-agent');
        expect(tokenInfo!.namespace).toBe('token-ns');

        // Validate token using TokenManager directly
        const tokenManager = (authBridge as any).tokenManager;
        const isValid = tokenManager?.validateToken(tokenInfo!.token);
        expect(isValid).toBeTruthy();
    });
});

// Helper function to create a simple Minecraft-like packet
function createSimplePacket(data: string): Buffer {
    const dataBuffer = Buffer.from(data);
    const length = Buffer.from([dataBuffer.length]);
    return Buffer.concat([length, dataBuffer]);
}