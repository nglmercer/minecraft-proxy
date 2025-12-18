import { BridgeServer } from '../src/index.js';

// Bridge Server Example (VPS Side)
// Run this on your VPS or Public Server (e.g., AWS, DigitalOcean, Hetzner)

// Configuration
const PORT = Number(process.env.PORT) || 25565; // The port effectively exposed to the internet
const SECRET = process.env.BRIDGE_SECRET || 'my-secure-secret';

console.log('--- Starting Bridge Server ---');
console.log(`Listening on port: ${PORT}`);
console.log(`Secret: ${SECRET} (Make sure this matches your Agent!)`);

const bridge = new BridgeServer({
    port: PORT,
    secret: SECRET,
    debug: true,
});

bridge.start();

console.log('Bridge is ready. Waiting for Agents and Players...');
