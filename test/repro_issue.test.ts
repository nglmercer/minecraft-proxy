
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { BridgeServer,type BridgeConfig } from '../src/lib/bridge/BridgeServer';
import { TunnelAgent } from '../src/lib/bridge/TunnelAgent';
import { randomUUID } from 'node:crypto';
import type { Socket } from 'bun';

describe('Bridge Routing Issue', () => {
    let bridge: BridgeServer;
    let agent: TunnelAgent;
    const BRIDGE_PORT = 30100; // Unique port for this test
    const BRIDGE_SECRET = 'test-secret';
    const TEST_AGENT_ID = 'caboose';
    const MC_PORT = 30101; 

    // Mock Minecraft Server
    let mcServer: any;

    beforeAll(async () => {
        // Start Mock MC Server
        mcServer = Bun.listen({
            hostname: '127.0.0.1',
            port: MC_PORT,
            socket: {
                data(socket, data) {
                    // Echo back a simple response
                    socket.write(data); 
                }
            }
        });

        // Start Bridge
        const bridgeConfig: BridgeConfig = {
            port: BRIDGE_PORT,
            secret: BRIDGE_SECRET,
            debug: true,
            domain: 'localhost' // Simulating local test env
        };
        bridge = new BridgeServer(bridgeConfig);
        bridge.start();

        // Wait a bit for bridge to be ready
        await new Promise(r => setTimeout(r, 100));
    });

    afterAll(() => {
        mcServer.stop();
        // Bridge stop method if available, or just let test end
    });

    it('should fail routing if agent does not claim the correct ID', async () => {
        // 1. Agent connects without specifying ID (gets random ID)
        const badAgent = new TunnelAgent({
            bridgeHost: 'localhost',
            bridgeControlPort: BRIDGE_PORT,
            localHost: '127.0.0.1',
            localPort: MC_PORT,
            secret: BRIDGE_SECRET,
            // agentId: intentionally missing
            debug: true
        });
        badAgent.start();

        await new Promise(r => setTimeout(r, 500));

        // 2. Client connects asking for 'caboose'
        // We simulate a Minecraft Handshake packet for 'caboose.localhost'
        // Handshake: Len | ID(0x00) | ProtoVer | Host | Port | State
        // Host = "caboose.localhost"
        
        const host = "caboose.localhost";
        const port = BRIDGE_PORT;
        
        // Construct Handshake Packet manually
        // VarInt(Len) + 0x00 + VarInt(Proto) + String(Host) + UShort(Port) + VarInt(State)
        
        const hostBuf = Buffer.from(host, 'utf8');
        const portBuf = Buffer.alloc(2);
        portBuf.writeUInt16BE(port);
        
        // Helper to simple varint
        const varInt = (val: number) => {
             const buf = [];
             while (true) {
                 if ((val & ~0x7F) == 0) {
                     buf.push(val);
                     break;
                 } else {
                     buf.push((val & 0x7F) | 0x80);
                     val >>>= 7;
                 }
             }
             return Buffer.from(buf);
        };

        const packetId = Buffer.from([0x00]);
        const protoVer = varInt(763); // 1.20.1
        const hostLen = varInt(hostBuf.length);
        const state = varInt(1); // Status

        const body = Buffer.concat([packetId, protoVer, hostLen, hostBuf, portBuf, state]);
        const len = varInt(body.length);
        const handshakePacket = Buffer.concat([len, body]);

        // Connect client
        let connected = false;
        try {
            const client = await Bun.connect({
                hostname: 'localhost',
                port: BRIDGE_PORT,
                socket: {
                    data(socket, data) {
                       // We expect to be disconnected or ignored
                    },
                    close() {
                        // Expected
                    }
                }
            });
            client.write(handshakePacket);
            
            // Wait to see if it closes
            await new Promise(r => setTimeout(r, 1000));
            // If we are here, we check connection state? 
            // Actually verifying if bridge logs "Dropping" is hard from here.
            // But we can check if we received any response. 
            // If routing worked, we'd get echo from MC server (since status state -> but our MC server echos raw).
        } catch (e) {
            // connection failed
        }
        
        // This test is manual verification mostly via logs, but we can structure it better if we had access to Bridge internals.
        // For now, let's just create the "Fixed" case which MUST work.
    });

    it('should SUCCEED routing if agent claims the correct ID', async () => {
        // 1. Agent connects WITH ID
        agent = new TunnelAgent({
            bridgeHost: 'localhost',
            bridgeControlPort: BRIDGE_PORT,
            localHost: '127.0.0.1',
            localPort: MC_PORT,
            secret: BRIDGE_SECRET,
            agentId: TEST_AGENT_ID, // 'caboose'
            debug: true
        });
        agent.start();

        await new Promise(r => setTimeout(r, 500));

        // 2. Client connects asking for 'caboose'
        const host = "caboose.localhost";
        
        // ... build packet ...
        const varInt = (val: number) => {
             const buf = [];
             while (true) {
                 if ((val & ~0x7F) == 0) {
                     buf.push(val);
                     break;
                 } else {
                     buf.push((val & 0x7F) | 0x80);
                     val >>>= 7;
                 }
             }
             return Buffer.from(buf);
        };

        const hostBuf = Buffer.from(host, 'utf8');
        const portBuf = Buffer.alloc(2);
        portBuf.writeUInt16BE(BRIDGE_PORT);
        
        const body = Buffer.concat([Buffer.from([0x00]), varInt(763), varInt(hostBuf.length), hostBuf, portBuf, varInt(1)]);
        const handshakePacket = Buffer.concat([varInt(body.length), body]);

        let responseReceived = false;

        const client = await Bun.connect({
            hostname: 'localhost',
            port: BRIDGE_PORT,
            socket: {
                data(socket, data) {
                    console.log('Client received data:', data.toString());
                    responseReceived = true;
                    socket.end();
                },
                error(err) { console.error("Client error", err); }
            }
        });

        client.write(handshakePacket);
        
        // Send a ping packet (Legacy or simple payload)
        // Handshake puts it in status state. Next packet should be 0x00 (Request).
        // BUT our mock MC server creates an echo. So whatever we sent (handshake) is forwarded to Agent -> Local MC -> Echo -> Agent -> Bridge -> Client.
        // So we should receive the handshake packet back.
        
        await new Promise(r => setTimeout(r, 2000));
        
        expect(responseReceived).toBe(true);
    });

});
