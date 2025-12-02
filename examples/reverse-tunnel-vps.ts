import { BridgeServer } from '../src/index.js';

// Configuration
const PUBLIC_PORT = 25565; // Players connect here
const CONTROL_PORT = 8080; // Home Agent connects here
const SECRET = 'my-super-secret-token';

console.log('Starting VPS Bridge Server...');

const bridge = new BridgeServer({
    publicPort: PUBLIC_PORT,
    controlPort: CONTROL_PORT,
    secret: SECRET,
    debug: true,
});

bridge.start();

console.log('Bridge is ready.');
console.log(`Players should connect to this VPS IP on port ${PUBLIC_PORT}`);
