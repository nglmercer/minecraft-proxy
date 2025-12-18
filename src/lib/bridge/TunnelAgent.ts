import type { Socket } from 'bun';

export interface AgentConfig {
    /** Hostname of the VPS Bridge (e.g., 'my-vps.com') */
    bridgeHost: string;
    /** Control port of the Bridge (e.g., 8080) */
    bridgeControlPort: number;
    /** Local Minecraft server host (e.g., 'localhost') */
    localHost: string;
    /** Local Minecraft server port (e.g., 25565) */
    localPort: number;
    /** Secret token to authenticate with the bridge */
    secret: string;
    debug?: boolean;
}

interface ControlSocketData {
    buffer: string;
    token?: string;
    agentId?: string;
    namespace?: string;
}

interface BridgeDataSocketData {
    target: Socket<LocalSocketData>;
}

interface LocalSocketData {
    target?: Socket<BridgeDataSocketData>;
    buffer: Uint8Array[];
}

export const defaultAgentConfig: AgentConfig = {
    bridgeHost: 'localhost',
    bridgeControlPort: 8080,
    localHost: 'localhost',
    localPort: 25565,
    secret: 'default-secret',
    debug: false
};

const MAX_CONCURRENT_CONNECTIONS = 50;
const MAX_PENDING_BUFFER_SIZE = 1024 * 1024; // 1MB

export class TunnelAgent {
    private config: AgentConfig;
    private controlSocket: Socket<ControlSocketData> | null = null;
    private reconnectTimer: Timer | null = null;
    private activeConnections = new Set<string>(); // local socket references could be stored if we need them

    constructor(config: AgentConfig) {
        this.config = config;
    }

    start() {
        this.connectControl();
    }

    private connectControl() {
        this.log(`Connecting to Bridge Control at ${this.config.bridgeHost}:${this.config.bridgeControlPort}...`);

        Bun.connect<ControlSocketData>({
            hostname: this.config.bridgeHost,
            port: this.config.bridgeControlPort,
            socket: {
                open: (socket) => {
                    socket.data = { buffer: '' };
                    this.log('Connected to Bridge. Authenticating...');
                    socket.write(`AUTH ${this.config.secret}\n`);
                },
                data: (socket, data) => {
                    const chunk = data.toString();
                    if (!socket.data || typeof socket.data.buffer !== 'string') {
                        socket.data = { buffer: '' };
                    }

                    if (socket.data.buffer.length + chunk.length > 1024 * 16) {
                        this.log('Bridge sent too much data without newline. Disconnecting.');
                        socket.end();
                        return;
                    }

                    socket.data.buffer += chunk;

                    const lines = socket.data.buffer.split('\n');
                    while (lines.length > 1) {
                        const msg = lines.shift()!.trim();
                        if (!msg) continue;

                        if (msg.startsWith('AUTH_OK')) {
                            const parts = msg.split(' ');
                            const assignedDomain = parts[1];
                            const token = parts[2];
                            
                            this.log(`Authenticated successfully. Domain: ${assignedDomain || 'default'}`);
                            this.controlSocket = socket;
                            
                            // Store token if provided (for token-based auth)
                            if (token && assignedDomain) {
                                socket.data.token = token;
                                const [agentId, namespace] = assignedDomain.split('.');
                                socket.data.agentId = agentId;
                                socket.data.namespace = namespace;
                                this.log(`Token received: ${token.substring(0, 8)}...`);
                            }
                            continue;
                        }


                        if (msg === 'AUTH_FAIL') {
                            this.log('Authentication failed. Check secret.');
                            socket.end();
                            return;
                        }

                        if (msg.startsWith('CONNECT ')) {
                            const connId = msg.split(' ')[1];
                            if (connId) {
                                this.handleConnectRequest(connId);
                            }
                        }
                    }
                    socket.data.buffer = lines[0] ?? '';
                },
                close: () => {
                    this.log('Bridge connection closed. Reconnecting in 5s...');
                    this.controlSocket = null;
                    this.scheduleReconnect();
                },
                error: (err) => {
                    this.log(`Bridge connection error: ${err}`);
                    this.controlSocket = null;
                }
            }
        }).catch(err => {
            this.log(`Failed to connect to bridge: ${err}`);
            this.scheduleReconnect();
        });
    }

    private scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connectControl();
        }, 5000);
    }

    private handleConnectRequest(connId: string) {
        if (this.activeConnections.size >= MAX_CONCURRENT_CONNECTIONS) {
            this.log(`Rejected connection ${connId}: Too many active connections (${this.activeConnections.size})`);
            // Ideally tell bridge to close, but we can't easily on control channel without protocol update.
            // Just ignoring it will cause bridge to timeout eventually.
            return;
        }

        this.log(`Opening tunnel for connection ${connId}...`);
        this.activeConnections.add(connId);
        this.stats.set(connId, { rx: 0, tx: 0 });

        // 1. Connect to Local Minecraft Server
        Bun.connect<LocalSocketData>({
            hostname: this.config.localHost,
            port: this.config.localPort,
            socket: {
                open: (localSocket) => {
                    localSocket.data = { buffer: [] };

                    // 2. Connect to Bridge (Data Channel)
                    Bun.connect<BridgeDataSocketData>({
                        hostname: this.config.bridgeHost,
                        port: this.config.bridgeControlPort,
                        socket: {
                            open: (bridgeDataSocket) => {
                                localSocket.data.target = bridgeDataSocket;

                                const header = Buffer.from(`DATA ${connId}\n`);
                                bridgeDataSocket.write(header);
                                const payload = Buffer.concat(localSocket.data.buffer);

                                if (localSocket.data.buffer.length > 0) {
                                    this.log(`Flushing ${payload.length} bytes of buffered data to bridge`);
                                    bridgeDataSocket.write(payload);
                                    this.updateStats(connId, 'tx', payload.length);
                                    localSocket.data.buffer = [];
                                }

                                bridgeDataSocket.data = { target: localSocket };
                            },
                            data: (bridgeDataSocket, data) => {
                                const target = bridgeDataSocket.data?.target;
                                if (target) {
                                    target.write(data);
                                    this.updateStats(connId, 'rx', data.length);
                                }
                            },
                            close: (bridgeDataSocket) => {
                                const target = bridgeDataSocket.data?.target;
                                this.log(`Bridge Data Channel closed for ${connId}`);
                                if (target) target.end();
                            },
                            error: (bridgeDataSocket) => {
                                const target = bridgeDataSocket.data?.target;
                                if (target) target.end();
                            }
                        }
                    }).catch(err => {
                        this.log(`Failed to connect data channel to bridge: ${err}`);
                        localSocket.end();
                    });
                },
                data: (localSocket, data) => {
                    const state = localSocket.data;
                    if (state.target) {
                        state.target.write(data);
                        this.updateStats(connId, 'tx', data.length);
                    } else {
                        // Check buffer limits
                        const currentSize = state.buffer.reduce((acc, c) => acc + c.length, 0);
                        if (currentSize + data.length > MAX_PENDING_BUFFER_SIZE) {
                             this.log(`Local buffer exceeded for ${connId}, dropping connection.`);
                             localSocket.end();
                             return;
                        }
                        state.buffer.push(Buffer.from(data));
                    }
                },
                close: (localSocket) => {
                    this.activeConnections.delete(connId);
                    const finalStats = this.stats.get(connId) || {rx:0, tx:0};
                    this.log(`Local connection ${connId} closed. Total RX(from Bridge): ${finalStats.rx}, Total TX(to Bridge): ${finalStats.tx}`);
                    this.stats.delete(connId);
                    const state = localSocket.data;
                    if (state?.target) {
                        state.target.end();
                    }
                },
                error: (localSocket) => {
                    this.activeConnections.delete(connId);
                    const state = localSocket.data;
                    if (state?.target) {
                        state.target.end();
                    }
                }
            }
        }).catch(err => {
            this.log(`Failed to connect to local Minecraft server: ${err}`);
            this.activeConnections.delete(connId);
        });
    }

    private log(msg: string) {
        if (this.config.debug) console.log(`[Agent] ${msg}`);
    }

    // Helper to track stats per connection
    private stats = new Map<string, { rx: number, tx: number }>();

    private updateStats(connId: string, type: 'rx' | 'tx', bytes: number) {
        let stat = this.stats.get(connId);
        if (!stat) {
            stat = { rx: 0, tx: 0 };
            this.stats.set(connId, stat);
        }
        stat[type] += bytes;
    }
}
