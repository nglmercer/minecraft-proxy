import { loadEnv } from '../utils/env-loader.js';
loadEnv();

import { startProxy } from '../index.js';

const LISTEN_PORT = parseInt(process.env.LISTEN_PORT || '25565');
const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '25566');
const DEBUG = process.env.DEBUG === 'true';

console.log('--- Minecraft TCP Proxy ---');
startProxy({
    listenPort: LISTEN_PORT,
    backendHost: BACKEND_HOST,
    backendPort: BACKEND_PORT,
    debug: DEBUG,
});
