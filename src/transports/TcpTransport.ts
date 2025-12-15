import type { Transport, Connection } from './Transport';
import type { Socket, Server } from 'bun';

interface TcpSocketData {
    connection: TcpConnection;
    listeners?: Record<string, Function[]>;
}

export class TcpConnection implements Connection {
    public data: Record<string, unknown> = {};
    constructor(private socket: Socket<TcpSocketData>) {}

    write(data: Uint8Array): void {
        this.socket.write(data);
    }

    close(): void {
        this.socket.end();
    }

    on(event: 'data', listener: (data: Uint8Array) => void): void;
    on(event: 'close', listener: () => void): void;
    on(event: 'error', listener: (err: Error) => void): void;
    on(event: string, listener: Function): void {
        // TcpSocketData is guaranteed to be initialized in listen/connect if we control creation,
        // but let's be safe or init if missing (though `socket.data` on incoming is set in `open`).
        
        // Note: For incoming sockets, `socket.data` is set in `open`.
        // If this class is used for outgoing, we must ensure `socket.data` is set.
        
        if (!this.socket.data) {
             // This is tricky if Socket<TcpSocketData> expects it to be there.
             // But usually we can assign.
             this.socket.data = { connection: this };
        }
        
        const data = this.socket.data;
        if (!data.listeners) data.listeners = {};
        
        if (!data.listeners[event]) {
            data.listeners[event] = [];
        }
        data.listeners[event].push(listener);
    }

    get remoteAddress() {
        return this.socket.remoteAddress;
    }

    get remotePort() {
        return this.socket.remotePort;
    }
    
    // For manual triggering by the Transport manager
    _trigger(event: string, ...args: unknown[]) {
        const listeners = this.socket.data?.listeners?.[event];
        if (listeners) {
            listeners.forEach((l) => (l as any)(...args));
        }
    }
}

// Minimal interface for Bun.listen return value
interface BunListener {
    stop(): void;
}

export class TcpTransport implements Transport {
    private server: BunListener | null = null;
    private connectionHandler: ((conn: Connection) => void) | null = null;
    
    async listen(port: number, host: string = '0.0.0.0'): Promise<void> {
        this.server = Bun.listen<TcpSocketData>({
            hostname: host,
            port: port,
            socket: {
                open: (socket) => {
                    const conn = new TcpConnection(socket);
                    socket.data = { connection: conn };
                    if (this.connectionHandler) {
                        this.connectionHandler(conn);
                    }
                },
                data: (socket, data) => {
                    const conn = socket.data.connection;
                    conn._trigger('data', data);
                },
                close: (socket) => {
                    const conn = socket.data.connection;
                    conn._trigger('close');
                },
                error: (socket, error) => {
                    const conn = socket.data.connection;
                    conn._trigger('error', error);
                }
            }
        });
        console.log(`TCP Transport listening on ${host}:${port}`);
    }

    onConnection(listener: (connection: Connection) => void): void {
        this.connectionHandler = listener;
    }

    close(): void {
        if (this.server) {
            this.server.stop();
        }
    }
}
