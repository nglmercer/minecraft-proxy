import { TunnelAgent } from '../src/index.js';

// Railway Agent Example
// PRE-CONFIGURED for your Railway setup.

// 1. Connection Details
// From User: "caboose.proxy.rlwy.net:54119"
const RAILWAY_PROXY_HOST = 'caboose.proxy.rlwy.net';
const RAILWAY_PROXY_PORT = 54119; 

// 2. Local Details
// Where is your Minecraft server running?
const LOCAL_MC_PORT = 25565;

// 3. Security
// Must match the BRIDGE_SECRET set in your Railway variables.
const SECRET = process.env.BRIDGE_SECRET || 'railway-secret-123';

console.log('--- Starting Railway Agent ---');
console.log(`Connecting to Railway: ${RAILWAY_PROXY_HOST}:${RAILWAY_PROXY_PORT}`);
console.log(`Forwarding to Local MC: localhost:${LOCAL_MC_PORT}`);

const agent = new TunnelAgent({
    bridgeHost: RAILWAY_PROXY_HOST,
    bridgeControlPort: RAILWAY_PROXY_PORT,
    localHost: 'localhost',
    localPort: LOCAL_MC_PORT,
    secret: SECRET,
    debug: true,
});

agent.start();

console.log('Agent is running. If the connection fails, check:');
console.log('1. Is the Railway service running?');
console.log('2. Does the Secret match?');
console.log('3. Is the TCP Proxy port (54119) correct?');
