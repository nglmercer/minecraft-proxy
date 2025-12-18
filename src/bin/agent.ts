import { loadConfig } from '../config/config-manager.js';
import { defaultAgentConfig } from '../reverse/agent.js';
import { TunnelAgent } from '../index.js';

console.log('--- Minecraft Tunnel Agent (Home) ---');

const config = await loadConfig('agent.yaml', defaultAgentConfig);

const agent = new TunnelAgent(config);
agent.start();
