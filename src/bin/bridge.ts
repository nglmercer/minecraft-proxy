import { loadEnv } from '../utils/env-loader.js';
loadEnv();

import { BridgeServer } from '../index.js';

const PUBLIC_PORT = parseInt(process.env.PUBLIC_PORT || '25565');
const CONTROL_PORT = parseInt(process.env.CONTROL_PORT || '8080');
const SECRET = process.env.SECRET || 'default-secret';
const DEBUG = process.env.DEBUG === 'true';

console.log('--- Minecraft Bridge Server (VPS) ---');
const bridge = new BridgeServer({
    publicPort: PUBLIC_PORT,
    controlPort: CONTROL_PORT,
    secret: SECRET,
    debug: DEBUG,
});

bridge.start();
