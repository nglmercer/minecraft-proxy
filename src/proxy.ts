import { createConfig, type ProxyConfig } from './config.js';
import { ProxyServer } from './ProxyServer.js';

/**
 * Starts the Minecraft proxy server.
 * @param config Optional configuration overrides
 * @returns The ProxyServer instance
 */
export async function startProxy(config?: Partial<ProxyConfig>) {
  const server = new ProxyServer(config);
  await server.start();
  return server;
}

// If this file is run directly, start the proxy
if (import.meta.main) {
  startProxy({ debug: true }).catch(console.error);
}
