
import { BridgeServer, type BridgeConfig } from './BridgeServer.js';
import { globalMetrics } from '../metrics/MetricsRegistry.js';

export class BridgeManager {
    private instances: Map<number, BridgeServer> = new Map();

    constructor() {
        globalMetrics.registerGauge('bridge_instances_count', 'Number of active bridge instances');
    }

    createInstance(config: BridgeConfig): BridgeServer {
        if (this.instances.has(config.port)) {
            throw new Error(`Bridge already running on port ${config.port}`);
        }

        const bridge = new BridgeServer(config);
        bridge.start();
        this.instances.set(config.port, bridge);
        
        globalMetrics.set('bridge_instances_count', this.instances.size);
        
        return bridge;
    }

    stopInstance(port: number) {
        const instance = this.instances.get(port);
        if (instance) {
            // instance.stop(); // TODO: Implement stop in BridgeServer if needed
            this.instances.delete(port);
            globalMetrics.set('bridge_instances_count', this.instances.size);
        }
    }

    getAllInstances(): BridgeServer[] {
        return Array.from(this.instances.values());
    }
}

export const defaultBridgeManager = new BridgeManager();
