import { createConfig, type ProxyConfig } from './config.js';
import { ConnectionHandler } from './connection-handler.js';

/**
 * Starts the Minecraft proxy server.
 * @param config Optional configuration overrides
 * @returns The Bun server instance
 */
export async function startProxy(config?: Partial<ProxyConfig>) {
  const fullConfig = createConfig(config);
  const server = Bun.listen<{ handler: ConnectionHandler }>({
    hostname: '0.0.0.0',
    port: fullConfig.proxyPort,
    socket: {
      open: (client) => {
        const handler = new ConnectionHandler(fullConfig);
        client.data = { handler };
        if (fullConfig.debug) {
          console.log(`New connection from ${client.remoteAddress}:${client.remotePort}`);
        }
      },
      close: (client) => {
        const handler = (client.data as any)?.handler as ConnectionHandler;
        if (handler) {
          handler.handleClientClose(client);
        }
      },
      error: (client, error) => {
        const handler = (client.data as any)?.handler as ConnectionHandler;
        if (handler) {
          handler.handleClientError(client, error);
        }
      },
      data: (client, data) => {
        const handler = (client.data as any)?.handler as ConnectionHandler;
        if (handler) {
          handler.handleClientData(client, data);
        }
      },
    },
  });

  console.log(`Minecraft proxy listening on port ${fullConfig.proxyPort}`);
  console.log(`Forwarding to Minecraft server: ${fullConfig.minecraftHost}:${fullConfig.minecraftPort}`);
  if (fullConfig.debug) {
    console.log('Debug mode enabled');
  }

  return server;
}

// If this file is run directly, start the proxy
if (import.meta.main) {
  startProxy({ debug: true }).catch(console.error);
}
