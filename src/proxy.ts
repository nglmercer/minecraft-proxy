import { createConfig, type ProxyConfig } from './config.js';
import { ConnectionHandler } from './connection-handler.js';

/**
 * Starts the Minecraft proxy server.
 * @param config Optional configuration overrides
 * @returns The Bun server instance
 */
export async function startProxy(config?: Partial<ProxyConfig>) {
  const fullConfig = createConfig(config);
  const connectionHandler = new ConnectionHandler(fullConfig);

  const server = Bun.listen({
    hostname: '0.0.0.0',
    port: fullConfig.listenPort,
    socket: {
      open: (client) => {
        connectionHandler.handleConnection(client);
      },
      close: (client) => {
        if (fullConfig.debug) {
          console.log('Socket closed');
        }
      },
      error: (client, error) => {
        console.error('Socket error:', error);
      },
    },
  });

  console.log(`Minecraft proxy listening on port ${fullConfig.listenPort}`);
  console.log(`Backend: ${fullConfig.backendHost}:${fullConfig.backendPort}`);
  if (fullConfig.debug) {
    console.log('Debug mode enabled');
  }

  return server;
}

// If this file is run directly, start the proxy
if (import.meta.main) {
  startProxy({ debug: true }).catch(console.error);
}
