import { createConfig, type ProxyConfig } from './config';
import type { Transport, Connection } from './transports/Transport';
import { TcpTransport } from './transports/TcpTransport';
import { UdpTransport } from './transports/UdpTransport';
import type { Protocol, Packet } from './protocols/Protocol';
import { MinecraftProtocol } from './protocols/MinecraftProtocol';
// import { parseHandshake } from './handshake'; // We use the Protocol interface now

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

        client.on('data', async (data) => {
            if (connected && backend) {
                backend.write(data);
                return;
            }

            // Buffer logic
            const newBuffer = new Uint8Array(buffer.length + data.length);
            newBuffer.set(buffer);
            newBuffer.set(data, buffer.length);
            buffer = newBuffer;

            if (!isHandshakeComplete) {
                try {
                    const packet = this.protocol.parse(buffer);
                    if (packet) {
                        isHandshakeComplete = true;
                        log('[Proxy] Handshake parsed:', packet.data);
                        
                        // Decide backend? 
                        // For now we use config.minecraftHost/Port.
                        // In future, packet.data could determine host.
                        
                        await this.connectBackend(client, buffer); // Send accumulated buffer
                        backend = client.data?.backend;
                        connected = true;
                        buffer = new Uint8Array(); // clear
                    }
                } catch (e: any) {
                    log('[Proxy] Handshake error or unknown protocol:', e.message);
                    client.close();
                }
            }
        });

        client.on('close', () => {
            log('[Proxy] Client closed');
            if (backend) backend.close();
        });

        client.on('error', (err) => {
            log('[Proxy] Client error:', err);
            if (backend) backend.close();
        });
    }

    private async connectBackend(client: Connection, initialData: Uint8Array) {
        const log = this.config.debug ? console.log : () => {};
        
        // We need a transport for the backend too.
        // Usually matches frontend, but not always.
        // For simplicity, reuse the same Transport Class (factory wise) or just Tcp?
        // Minecraft Bedrock (UDP) -> usually UDP backend.
        // Minecraft Java (TCP) -> TCP backend.
        
        let backendTransport: Transport;
        // In a real generic implementation, we'd need a way to spawn clients.
        // Transport interface as defined is a Server (listen).
        // we need a client connector.
        
        // Let's cheat a bit and use direct Bun.connect / Bun.udpSocket for backend for now,
        // OR extend Transport to have `connect()`.
        
        // Let's extend the logic inline for now, but modularity suggests Transport should handle it.
        // I'll assume TCP for now if not UdpTransport, but UdpTransport isn't really "connectable" in the same way (no handshake).
        
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
                
                // Wrap in Connection?
                // UDP "Connection" needs to send to destination.
                // The `socket` here is bound locally. sending needs dest.
                
                const backendConn = {
                    write: (data: Uint8Array) => {
                        socket.send(data, this.config.minecraftPort, this.config.minecraftHost);
                    },
                    close: () => socket.close(),
                    on: () => {}, // Not used here as we used callbacks above
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

        } catch (err) {
            log('[Proxy] Failed to connect to backend', err);
            client.close();
        }
    }
}
