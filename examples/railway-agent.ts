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
    localHost: '127.0.0.1',
    localPort: LOCAL_MC_PORT,
    secret: SECRET,
    debug: true,
});

agent.start();

console.log('Agent is running.');
console.log('---------------------------------------------------------');
console.log('HOW TO CONNECT:');
console.log(`1. In Minecraft, simply add server: ${RAILWAY_PROXY_HOST}:${RAILWAY_PROXY_PORT}`);
console.log('   (No need for subdomains like ada30e56...)');
console.log('2. IMPORTANT: You see "Authenticated successfully. Domain: ..."? IGNORE THE DOMAIN.');
console.log('   New "Single-Tenant Mode" will route ALL traffic to you automatically.');
console.log('---------------------------------------------------------');

