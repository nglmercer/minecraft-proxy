import type { Transport, Connection } from './Transport';
import type { Socket } from 'bun';

// Bun's UDP socket type definition is tricky in some versions.
interface BunUDPSocket {
    send(data: Uint8Array | string | Buffer, port: number, address: string): number | boolean;
    close(): void;
    reload(options: any): void;
}

interface UdpSession {
    address: string;
    port: number;
    lastActive: number;
    connection: UdpConnection;
    listeners: Record<string, Function[]>;
}

export class UdpConnection implements Connection {
    public data: Record<string, unknown> = {};
    constructor(
        private socket: BunUDPSocket,
        public remoteAddress: string,
        public remotePort: number,
        private sessionParams: UdpSession
    ) {}

    write(data: Uint8Array): void {
        this.socket.send(data, this.remotePort, this.remoteAddress);
    }

    close(): void {
        // In UDP, closing means removing the session.
        this._trigger('close');
        // Actual cleanup should happen in the Transport manager, 
        // but currently UdpTransport manages sessions via timeout.
        // Ideally we should signal transport to remove session immediately.
    }

    on(event: 'data', listener: (data: Uint8Array) => void): void;
    on(event: 'close', listener: () => void): void;
    on(event: 'error', listener: (err: Error) => void): void;
    on(event: string, listener: Function): void {
        if (!this.sessionParams.listeners[event]) {
            this.sessionParams.listeners[event] = [];
        }
        this.sessionParams.listeners[event].push(listener);
    }
    
    _trigger(event: string, ...args: unknown[]) {
        const listeners = this.sessionParams.listeners[event];
        if (listeners) {
            listeners.forEach(l => (l as any)(...args));
        }
    }
}

export class UdpTransport implements Transport {
    private socket: BunUDPSocket | null = null;
    private connectionHandler: ((conn: Connection) => void) | null = null;
    private sessions = new Map<string, UdpSession>();
    private cleanupInterval: Timer | null = null;
    private sessionTimeoutMs = 60000; // 60s timeout for UDP sessions

    async listen(port: number, host: string = '0.0.0.0'): Promise<void> {
        this.socket = (await Bun.udpSocket({
            hostname: host,
            port: port,
            socket: {
                data: (socket, data, port, address) => {
                    const key = `${address}:${port}`;
                    let session = this.sessions.get(key);

                    if (!session) {
                        // Create partial session first then assign connection
                         session = {
                            address,
                            port,
                            lastActive: Date.now(),
                            listeners: {},
                            connection: undefined as any // assigned below
                        };
                        const conn = new UdpConnection(socket, address, port, session);
                        session.connection = conn;
                        this.sessions.set(key, session);

                        if (this.connectionHandler) {
                            this.connectionHandler(conn);
                        }
                    }

                    session.lastActive = Date.now();
                    session.connection._trigger('data', data);
                },
                error: (socket, error) => {
                    console.error("UDP Socket Error", error);
                }
            }
        })) as unknown as BunUDPSocket;

        console.log(`UDP Transport listening on ${host}:${port}`);
        
        // Start cleanup timer
        this.cleanupInterval = setInterval(() => this.cleanupSessions(), 10000);
    }

    private cleanupSessions() {
        const now = Date.now();
        for (const [key, session] of this.sessions.entries()) {
            if (now - session.lastActive > this.sessionTimeoutMs) {
                session.connection._trigger('close');
                this.sessions.delete(key);
            }
        }
    }

    onConnection(listener: (connection: Connection) => void): void {
        this.connectionHandler = listener;
    }

    close(): void {
        if (this.socket) {
            this.socket.close(); // Bun 1.1+ supports .close() on UDPSocket (which is usually just void)
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
