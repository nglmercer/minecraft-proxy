import { loadConfig } from '../config-manager.js';
import { defaultBridgeConfig } from '../reverse/bridge.js';
import { BridgeServer } from '../index.js';

console.log('--- Minecraft Bridge Server (VPS) ---');

const config = await loadConfig('bridge.yaml', defaultBridgeConfig);

const bridge = new BridgeServer(config);
bridge.start();
