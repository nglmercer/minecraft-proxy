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

interface LocalSocketData {
    target?: Socket<any>;
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

export class TunnelAgent {
    private config: AgentConfig;
    private controlSocket: Socket<any> | null = null;
    private reconnectTimer: Timer | null = null;

    constructor(config: AgentConfig) {
        this.config = config;
    }

    start() {
        this.connectControl();
    }

    private connectControl() {
        this.log(`Connecting to Bridge Control at ${this.config.bridgeHost}:${this.config.bridgeControlPort}...`);

        Bun.connect({
            hostname: this.config.bridgeHost,
            port: this.config.bridgeControlPort,
            socket: {
                open: (socket) => {
                    this.log('Connected to Bridge. Authenticating...');
                    socket.write(`AUTH ${this.config.secret}\n`);
                },
                data: (socket, data) => {
                    const msg = data.toString().trim();

                    if (msg === 'AUTH_OK') {
                        this.log('Authenticated successfully. Waiting for connections...');
                        this.controlSocket = socket;
                        return;
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
                },
                close: () => {
                    this.log('Bridge connection closed. Reconnecting in 5s...');
                    this.controlSocket = null;
                    this.scheduleReconnect();
                },
                error: (err) => {
                    this.log(`Bridge connection error: ${err}`);
                    this.controlSocket = null;
                    // Reconnect handled by close
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
        this.log(`Opening tunnel for connection ${connId}...`);

        // 1. Connect to Local Minecraft Server
        Bun.connect<LocalSocketData>({
            hostname: this.config.localHost,
            port: this.config.localPort,
            socket: {
                open: (localSocket) => {
                    localSocket.data = { buffer: [] };

                    // 2. Connect to Bridge (Data Channel)
                    Bun.connect<{ target: Socket<any> }>({
                        hostname: this.config.bridgeHost,
                        port: this.config.bridgeControlPort,
                        socket: {
                            open: (bridgeDataSocket) => {
                                // Local -> Bridge
                                localSocket.data.target = bridgeDataSocket;

                                // Flush buffer as a single chunk to ensure atomicity
                                const header = Buffer.from(`DATA ${connId}\n`);
                                if (localSocket.data.buffer.length > 0) {
                                    const payload = Buffer.concat(localSocket.data.buffer);
                                    this.log(`Flushing ${payload.length} bytes of buffered data to bridge`);
                                    const combined = Buffer.concat([header, payload]);
                                    bridgeDataSocket.write(combined);
                                    localSocket.data.buffer = [];
                                } else {
                                    bridgeDataSocket.write(header);
                                }

                                // Bridge -> Local
                                bridgeDataSocket.data = { target: localSocket };
                            },
                            data: (bridgeDataSocket, data) => {
                                const target = (bridgeDataSocket.data as any)?.target as Socket;
                                if (target) target.write(data);
                            },
                            close: (bridgeDataSocket) => {
                                const target = (bridgeDataSocket.data as any)?.target as Socket;
                                if (target) target.end();
                            },
                            error: (bridgeDataSocket) => {
                                const target = (bridgeDataSocket.data as any)?.target as Socket;
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
                    } else {
                        // Buffer data if bridge connection isn't ready yet
                        state.buffer.push(new Uint8Array(data));
                    }
                },
                close: (localSocket) => {
                    const state = localSocket.data;
                    if (state?.target) {
                        state.target.end();
                    }
                },
                error: (localSocket) => {
                    const state = localSocket.data;
                    if (state?.target) {
                        state.target.end();
                    }
                }
            }
        }).catch(err => {
            this.log(`Failed to connect to local Minecraft server: ${err}`);
            // We should probably tell the bridge to abort, but in this simple version, 
            // the bridge will timeout or the player will just get disconnected.
        });
    }

    private log(msg: string) {
        if (this.config.debug) console.log(`[Agent] ${msg}`);
    }
}
