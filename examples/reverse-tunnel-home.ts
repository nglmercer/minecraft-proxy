import { TunnelAgent } from '../src/index.js';

// Configuration
const VPS_HOST = 'localhost'; // Change this to your VPS IP (e.g., '1.2.3.4')
const VPS_CONTROL_PORT = 8080;
const LOCAL_MC_HOST = 'localhost';
const LOCAL_MC_PORT = 25565;
const SECRET = 'my-super-secret-token';

console.log('Starting Home Tunnel Agent...');

const agent = new TunnelAgent({
    bridgeHost: VPS_HOST,
    bridgeControlPort: VPS_CONTROL_PORT,
    localHost: LOCAL_MC_HOST,
    localPort: LOCAL_MC_PORT,
    secret: SECRET,
    debug: true,
});

agent.start();

console.log('Agent started. Connecting to VPS...');
