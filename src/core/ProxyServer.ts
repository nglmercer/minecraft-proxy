import { createConfig, type ProxyConfig } from '../config/config.js';
import type { Transport, Connection } from '../transports/Transport.js';
import { TcpTransport } from '../transports/TcpTransport.js';
import { UdpTransport } from '../transports/UdpTransport.js';
import type { Protocol, Packet } from '../protocols/Protocol.js';
import { MinecraftProtocol } from '../protocols/MinecraftProtocol.js';

const MAX_HANDSHAKE_SIZE = 4096; // 4KB
const HANDSHAKE_TIMEOUT_MS = 5000;

export class ProxyServer {
    private transport: Transport;
    private protocol: Protocol;
    private config: ProxyConfig;

    constructor(config?: Partial<ProxyConfig>, protocol?: Protocol) {
        this.config = createConfig(config);
        
        if (this.config.transportType === 'udp') {
            this.transport = new UdpTransport();
        } else {
            this.transport = new TcpTransport();
        }

        this.protocol = protocol || new MinecraftProtocol();
    }

    async start() {
        this.transport.onConnection((client) => this.handleClient(client));
        await this.transport.listen(this.config.proxyPort);
        if (this.config.debug) {
            console.log(`[Proxy] Listening on ${this.config.transportType.toUpperCase()} :${this.config.proxyPort}`);
        }
    }

    stop() {
        this.transport.close();
    }

    private handleClient(client: Connection) {
        const log = this.config.debug ? console.log : () => {};
        log(`[Proxy] New connection from ${client.remoteAddress}:${client.remotePort}`);

        let buffer: Uint8Array = new Uint8Array();
        let connected = false;
        let backend: Connection | null = null;
        let isHandshakeComplete = false;

        const handshakeTimeout = setTimeout(() => {
            if (!isHandshakeComplete) {
                log('[Proxy] Handshake timeout');
                client.close();
            }
        }, HANDSHAKE_TIMEOUT_MS);

        const cleanup = () => {
            clearTimeout(handshakeTimeout);
            if (backend) backend.close();
        };

        client.on('data', async (dataArg: unknown) => {
            const data = dataArg as Uint8Array;
            if (connected && backend) {
                backend.write(data);
                return;
            }

            // Buffer logic
            if (buffer.length + data.length > MAX_HANDSHAKE_SIZE) {
                log('[Proxy] Handshake buffer overflow');
                client.close();
                return;
            }

            const newBuffer = new Uint8Array(buffer.length + data.length);
            newBuffer.set(buffer);
            newBuffer.set(data, buffer.length);
            buffer = newBuffer;

            if (!isHandshakeComplete) {
                try {
                    const packet = this.protocol.parse(buffer);
                    if (packet) {
                        isHandshakeComplete = true;
                        clearTimeout(handshakeTimeout);
                        
                        log('[Proxy] Handshake parsed:', packet.data);
                        
                        // Decide backend? 
                        await this.connectBackend(client, buffer); // Send accumulated buffer
                        
                        // Safely retrieve backend from data
                        backend = (client.data?.['backend'] as Connection) || null;
                        
                        connected = true;
                        buffer = new Uint8Array(); // clear
                    }
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    log('[Proxy] Handshake error or unknown protocol:', msg);
                    client.close();
                }
            }
        });

        client.on('close', () => {
            log('[Proxy] Client closed');
            cleanup();
        });

        client.on('error', (err: unknown) => {
            log('[Proxy] Client error:', err);
            cleanup();
        });
    }

    private async connectBackend(client: Connection, initialData: Uint8Array) {
        const log = this.config.debug ? console.log : () => {};
        
        try {
            if (this.config.transportType === 'udp') {
                // UDP Backend
                const socket = await Bun.udpSocket({
                    port: 0,
                    socket: {
                        data: (s, data, port, addr) => {
                           client.write(data);
                        },
                        error: (s, err) => {
                           client.close();
                        }
                    }
                });
                
                const backendConn = {
                    write: (data: Uint8Array) => {
                        socket.send(data, this.config.minecraftPort, this.config.minecraftHost);
                    },
                    close: () => socket.close(),
                    on: () => {}, 
                    // ...
                } as unknown as Connection;
                
                client.data = { backend: backendConn };
                
                // Forward initial data
                backendConn.write(initialData);

            } else {
                // TCP Backend
                 const socket = await Bun.connect({
                    hostname: this.config.minecraftHost,
                    port: this.config.minecraftPort,
                    socket: {
                        data: (s, data) => {
                            client.write(new Uint8Array(data));
                        },
                        open: (s) => {
                            log('[Proxy] Connected to backend');
                        },
                        close: () => client.close(),
                        error: () => client.close()
                    }
                });
                
                const backendConn = {
                    write: (data: Uint8Array) => socket.write(data),
                    close: () => socket.end(),
                    on: () => {}
                } as unknown as Connection;

                client.data = { backend: backendConn };
                
                // Forward initial data
                backendConn.write(initialData);
            }

        } catch (err: unknown) {
            log('[Proxy] Failed to connect to backend', err);
            client.close();
        }
    }
}
