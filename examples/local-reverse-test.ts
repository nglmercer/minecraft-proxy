import { BridgeServer, TunnelAgent } from '../src/index.js';

// --- CONFIGURATION ---
const MINECRAFT_PORT = 25565; // Your running local Minecraft server
const VPS_PUBLIC_PORT = 25567; // Players will connect here (simulated VPS port)
const VPS_CONTROL_PORT = 8080; // Internal control port
const SECRET = 'local-test-secret';

console.log('--- STARTING LOCAL REVERSE TUNNEL TEST ---');

// 1. Start the Bridge (Simulating the VPS)
console.log('[1/2] Starting Simulated VPS Bridge...');
const bridge = new BridgeServer({
    publicPort: VPS_PUBLIC_PORT,
    controlPort: VPS_CONTROL_PORT,
    secret: SECRET,
    debug: true,
});
bridge.start();

// 2. Start the Agent (Simulating your Home PC)
console.log('[2/2] Starting Home Agent...');
const agent = new TunnelAgent({
    bridgeHost: 'localhost', // Connecting to the "VPS" on localhost
    bridgeControlPort: VPS_CONTROL_PORT,
    localHost: 'localhost',
    localPort: MINECRAFT_PORT, // Forwarding to your real Minecraft
    secret: SECRET,
    debug: true,
});
agent.start();

console.log('\n--- READY ---');
console.log(`Connect your Minecraft Client to: localhost:${VPS_PUBLIC_PORT}`);
console.log(`Traffic will flow: Client -> Bridge(:${VPS_PUBLIC_PORT}) -> Agent -> Minecraft(:${MINECRAFT_PORT})`);
