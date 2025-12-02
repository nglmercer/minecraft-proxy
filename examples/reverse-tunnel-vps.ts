import { BridgeServer } from '../src/index.js';

// Configuration
const PORT = Number(process.env.PORT) || 54119; // Single port for everything
const SECRET = 'my-super-secret-token';
//caboose.proxy.rlwy.net:54119 ---> Multiplexed

console.log('Starting VPS Bridge Server (Multiplexed)...');

const bridge = new BridgeServer({
    port: PORT,
    secret: SECRET,
    debug: true,
});

bridge.start();

console.log('Bridge is ready.');
console.log(`Agent AND Players should connect to this VPS IP on port ${PORT}`);
