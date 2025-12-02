import { loadEnv } from '../utils/env-loader.js';
loadEnv();

import { TunnelAgent } from '../index.js';

const BRIDGE_HOST = process.env.BRIDGE_HOST || 'localhost';
const BRIDGE_CONTROL_PORT = parseInt(process.env.BRIDGE_CONTROL_PORT || '8080');
const LOCAL_HOST = process.env.LOCAL_HOST || 'localhost';
const LOCAL_PORT = parseInt(process.env.LOCAL_PORT || '25565');
const SECRET = process.env.SECRET || 'default-secret';
const DEBUG = process.env.DEBUG === 'true';

console.log('--- Minecraft Tunnel Agent (Home) ---');
const agent = new TunnelAgent({
    bridgeHost: BRIDGE_HOST,
    bridgeControlPort: BRIDGE_CONTROL_PORT,
    localHost: LOCAL_HOST,
    localPort: LOCAL_PORT,
    secret: SECRET,
    debug: DEBUG,
});

agent.start();
