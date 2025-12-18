
import { loadConfig } from '../config/config-manager.js';
import { defaultBridgeConfig } from '../lib/bridge/BridgeServer.js';
import { defaultBridgeManager } from '../lib/bridge/BridgeManager.js';

console.log('--- Minecraft Bridge Server (VPS) ---');

try {
    const config = await loadConfig('bridge.yaml', defaultBridgeConfig);
    
    // Create the bridge instance using the manager
    defaultBridgeManager.createInstance(config);
    
    console.log(`Bridge Server running on port ${config.port}`);
    if (config.domain) {
        console.log(`Subdomain routing enabled for domain: ${config.domain}`);
    }
} catch (error) {
    console.error('Failed to start bridge server:', error);
    process.exit(1);
}
