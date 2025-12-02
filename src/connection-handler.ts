import { parseHandshake } from './handshake.js';
import { createTunnel } from './tunnel.js';
import type { ProxyConfig } from './config.js';

type Socket = any; // To avoid TypeScript issues with Bun's Socket

export class ConnectionHandler {
  private config: ProxyConfig;
  private handshakeBuffer: Uint8Array = new Uint8Array();
  private handshakeParsed = false;
  private backendSocket: Socket | null = null;
  private connectFunction: typeof Bun.connect;

  constructor(config: ProxyConfig, connectFunction: typeof Bun.connect = Bun.connect) {
    this.config = config;
    this.connectFunction = connectFunction;
  }

  /**
   * Handles a new client connection.
   */
  handleConnection(client: Socket): void {
    const log = this.config.debug ? console.log : () => { };
    log(`New connection from ${client.remoteAddress}:${client.remotePort}`);

    const cleanup = () => {
      if (client.readyState === 'open') {
        client.end();
      }
      if (this.backendSocket && this.backendSocket.readyState === 'open') {
        this.backendSocket.end();
      }
    };

    // Handle client data
    client.data = (data: Buffer) => {
      if (!this.handshakeParsed) {
        this.handleHandshake(client, data, cleanup, log);
      }
      // Once handshake is parsed, the tunnel will handle further data
    };

    client.close = () => {
      log('Client disconnected before handshake completed');
      cleanup();
    };

    client.error = (error: Error) => {
      log(`Client socket error: ${error}`);
      cleanup();
    };
  }

  /**
   * Processes handshake data from the client.
   * If the handshake is complete, connects to the backend and sets up the tunnel.
   */
  private handleHandshake(client: Socket, data: Buffer, cleanup: () => void, log: (...args: any[]) => void): void {
    // Append new data to buffer
    const newBuffer = new Uint8Array(this.handshakeBuffer.length + data.length);
    newBuffer.set(this.handshakeBuffer);
    newBuffer.set(data, this.handshakeBuffer.length);
    this.handshakeBuffer = newBuffer;

    try {
      const { handshake, bytesRead } = parseHandshake(this.handshakeBuffer);
      log('Parsed handshake:', handshake);
      this.handshakeParsed = true;

      // Connect to backend
      this.connectFunction({
        hostname: this.config.backendHost,
        port: this.config.backendPort,
        socket: {
          open: (backend: Socket) => {
            log(`Connected to backend at ${this.config.backendHost}:${this.config.backendPort}`);
            this.backendSocket = backend;

            // Send handshake packet to backend
            backend.write(this.handshakeBuffer.slice(0, bytesRead));

            // Send any leftover data
            if (bytesRead < this.handshakeBuffer.length) {
              const leftover = this.handshakeBuffer.slice(bytesRead);
              backend.write(leftover);
            }

            // Create tunnel between client and backend
            createTunnel(client, backend, {
              onClose: () => {
                log('Tunnel closed');
              },
              onError: (error) => {
                log(`Tunnel error: ${error}`);
                cleanup();
              },
              debug: this.config.debug,
            });
          },
          data: (backend: Socket, chunk: Buffer) => {
            // This should not be called because tunnel handles data forwarding
          },
          close: (backend: Socket) => {
            log('Backend connection closed during handshake');
          },
          error: (backend: Socket, error: Error) => {
            log(`Backend connection error: ${error}`);
            cleanup();
          },
        },
      }).catch((error) => {
        log(`Failed to connect to backend: ${error}`);
        client.end();
      });
    } catch (error: any) {
      if (error.message === 'Buffer too short') {
        // Not enough data yet, wait for more
        return;
      }
      log(`Handshake error: ${error.message}`);
      client.end();
    }
  }
}
