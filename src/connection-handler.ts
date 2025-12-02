import { parseHandshake } from './handshake.js';
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
  /**
   * Handles data received from the client.
   */
  private clientBuffer: Buffer[] = [];
  private isConnecting = false;

  handleClientData(client: Socket, data: Buffer): void {
    const log = this.config.debug ? console.log : () => { };

    if (this.handshakeParsed) {
      // If we have a backend socket instance, try to write to it directly.
      if (this.backendSocket) {
        // Bun's socket.write returns bytes written or throws/returns 0 if closed
        try {
          // Check state loosely or just try write
          if (this.backendSocket.readyState === 'open' || this.backendSocket.readyState === 1) {
            this.backendSocket.write(data);
          } else {
            log(`Backend socket not open (state: ${this.backendSocket.readyState}), cannot forward data.`);
            // If it was previously open, this means it closed.
            // We should probably close the client too.
            this.cleanup(client);
          }
        } catch (err) {
          log(`Error writing to backend: ${err}`);
          this.cleanup(client);
        }
      } else {
        // Handshake parsed but backendSocket is null -> We are strictly in "Connecting" phase.
        log(`Buffering ${data.length} bytes from client (connecting to backend)`);
        this.clientBuffer.push(data);
      }
      return;
    }

    this.handleHandshake(client, data, () => this.cleanup(client), log);
  }

  handleClientClose(client: Socket): void {
    const log = this.config.debug ? console.log : () => { };
    log('Client disconnected');
    this.cleanup(client);
  }

  handleClientError(client: Socket, error: Error): void {
    const log = this.config.debug ? console.log : () => { };
    log(`Client socket error: ${error}`);
    this.cleanup(client);
  }

  private cleanup(client: Socket) {
    if (client.readyState === 'open') {
      client.end();
    }
    if (this.backendSocket && this.backendSocket.readyState === 'open') {
      this.backendSocket.end();
    }
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
        hostname: this.config.minecraftHost,
        port: this.config.minecraftPort,
        socket: {
          open: (backend: Socket) => {
            log(`Connected to Minecraft server at ${this.config.minecraftHost}:${this.config.minecraftPort}`);
            this.backendSocket = backend;

            // Send handshake packet to backend
            const writtenHandshake = backend.write(this.handshakeBuffer.slice(0, bytesRead));
            log(`Sent handshake to backend: ${writtenHandshake} bytes`);

            // Send any leftover data
            if (bytesRead < this.handshakeBuffer.length) {
              const leftover = this.handshakeBuffer.slice(bytesRead);
              const writtenLeftover = backend.write(leftover);
              log(`Sent leftover data to backend: ${writtenLeftover} bytes`);
            }

            log('Tunnel established');

            // Flush buffered client data
            if (this.clientBuffer.length > 0) {
              log(`Flushing ${this.clientBuffer.length} buffered packets to backend`);
              for (const chunk of this.clientBuffer) {
                backend.write(chunk);
              }
              this.clientBuffer = [];
            }
          },
          data: (backend: Socket, chunk: Buffer) => {
            log(`Received ${chunk.length} bytes from backend`);
            // Forward data to client
            // Bun might return readyState as string 'open' or number 1
            if (client.readyState === 'open' || client.readyState === 1) {
              const written = client.write(chunk);
              log(`Forwarded to client: ${written} bytes`);
            } else {
              log(`Client not open (state: ${client.readyState}), closing backend`);
              backend.end();
            }
          },
          drain: (backend: Socket) => {
            // Optional: handle backpressure
          },
          close: (backend: Socket) => {
            log('Backend connection closed');
            this.cleanup(client);
          },
          error: (backend: Socket, error: Error) => {
            log(`Backend connection error: ${error}`);
            this.cleanup(client);
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
