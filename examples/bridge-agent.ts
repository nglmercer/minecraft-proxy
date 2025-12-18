import { TunnelAgent } from '../src/index.js';

// Bridge Agent Example (Home Side)
// Run this on your home computer or where your Minecraft server is located.

// Configuration
const BRIDGE_HOST = process.env.BRIDGE_HOST || 'my-vps-ip.com';
const BRIDGE_PORT = Number(process.env.BRIDGE_PORT) || 25565;
const LOCAL_SERVER_PORT = 25565; // Your local Minecraft server port
const SECRET = process.env.BRIDGE_SECRET || 'my-secure-secret';

console.log('--- Starting Tunnel Agent ---');
console.log(`Target Bridge: ${BRIDGE_HOST}:${BRIDGE_PORT}`);
console.log(`Local Server: localhost:${LOCAL_SERVER_PORT}`);

const agent = new TunnelAgent({
    bridgeHost: BRIDGE_HOST,
    bridgeControlPort: BRIDGE_PORT,
    localHost: 'localhost',
    localPort: LOCAL_SERVER_PORT,
    secret: SECRET,
    debug: true,
});

agent.start();
