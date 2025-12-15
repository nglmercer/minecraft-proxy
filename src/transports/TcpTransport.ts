import type { Transport, Connection } from './Transport';
import type { Socket } from 'bun';

export class TcpConnection implements Connection {
    public data: any = {};
    constructor(private socket: Socket<any>) {}

    write(data: Uint8Array): void {
        this.socket.write(data);
    }

    close(): void {
        this.socket.end();
    }

    on(event: 'data' | 'close' | 'error', listener: any): void {
        // Bun sockets use callbacks defined in listen/connect.
        // Since we are wrapping an existing socket passed from "listen",
        // we might need to intercept the callbacks or use a different approach.
        // However, Bun.listen requires defining handlers *at creation*.
        // So TcpTransport needs to handle the mapping.
        
        // This suggests TcpConnection works best if it's an Event Emitter or 
        // if callbacks are assigned to it.
        
        // Let's implement a simple listener registry here.
        if (!this.socket.data) this.socket.data = {};
        if (!this.socket.data.listeners) this.socket.data.listeners = {};
        
        if (!this.socket.data.listeners[event]) {
            this.socket.data.listeners[event] = [];
        }
        this.socket.data.listeners[event].push(listener);
    }

    get remoteAddress() {
        return this.socket.remoteAddress;
    }

    get remotePort() {
        return this.socket.remotePort;
    }
    
    // For manual triggering by the Transport manager
    _trigger(event: string, ...args: any[]) {
        const listeners = (this.socket.data as any)?.listeners?.[event];
        if (listeners) {
            listeners.forEach((l: any) => l(...args));
        }
    }
}

export class TcpTransport implements Transport {
    private server: any; // Bun Server
    private connectionHandler: ((conn: Connection) => void) | null = null;
    
    async listen(port: number, host: string = '0.0.0.0'): Promise<void> {
        this.server = Bun.listen<{ connection: TcpConnection }>({
            hostname: host,
            port: port,
            socket: {
                open: (socket) => {
                    const conn = new TcpConnection(socket);
                    socket.data = { connection: conn }; // Link wrapper to socket
                    if (this.connectionHandler) {
                        this.connectionHandler(conn);
                    }
                },
                data: (socket, data) => {
                    const conn = (socket.data as any).connection as TcpConnection;
                    conn._trigger('data', data);
                },
                close: (socket) => {
                    const conn = (socket.data as any).connection as TcpConnection;
                    conn._trigger('close');
                },
                error: (socket, error) => {
                    const conn = (socket.data as any).connection as TcpConnection;
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
