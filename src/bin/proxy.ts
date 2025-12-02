import { loadConfig } from '../config-manager.js';
import { defaultConfig } from '../config.js';
import { startProxy } from '../index.js';

console.log('--- Minecraft TCP Proxy ---');

const config = await loadConfig('proxy.yaml', defaultConfig);

startProxy(config).catch(console.error);
