import type { Socket } from 'bun';

export interface BridgeConfig {
    publicPort: number;
    controlPort: number;
    secret: string;
    debug?: boolean;
}

type SocketState =
    | { type: 'HANDSHAKE' }
    | { type: 'CONTROL'; authenticated: boolean }
    | { type: 'DATA'; target: Socket };

export class BridgeServer {
    private config: BridgeConfig;
    private controlSocket: Socket<any> | null = null;
    private pendingPlayers = new Map<string, Socket<any>>();

    constructor(config: BridgeConfig) {
        this.config = config;
    }

    start() {
        // 1. Control & Data Server (Agent connects here)
        Bun.listen<{ type: string; authenticated?: boolean; target?: Socket }>({
            hostname: '0.0.0.0',
            port: this.config.controlPort,
            socket: {
                open: (socket) => {
                    socket.data = { type: 'HANDSHAKE' };
                },
                data: (socket, data) => {
                    const state = socket.data as SocketState;

                    // Case 1: Tunneling Data (Fast path)
                    if (state.type === 'DATA') {
                        state.target.write(data);
                        return;
                    }

                    // Case 2: Handshake / Control
                    const msg = data.toString(); // Don't trim blindly, binary data might look like whitespace

                    if (state.type === 'HANDSHAKE') {
                        if (msg.startsWith('AUTH ')) {
                            const secret = msg.trim().split(' ')[1];
                            if (secret === this.config.secret) {
                                socket.data = { type: 'CONTROL', authenticated: true };
                                this.controlSocket = socket;
                                this.log('Agent authenticated (Control Channel)');
                                socket.write('AUTH_OK\n');
                            } else {
                                socket.write('AUTH_FAIL\n');
                                socket.end();
                            }
                            return;
                        }

                        if (msg.startsWith('DATA ')) {
                            const connId = msg.trim().split(' ')[1];
                            if (connId && this.pendingPlayers.has(connId)) {
                                const playerSocket = this.pendingPlayers.get(connId)!;
                                this.pendingPlayers.delete(connId);

                                // Link them
                                socket.data = { type: 'DATA', target: playerSocket };

                                // We also need to tell the Player Socket to forward to THIS socket
                                const playerData = playerSocket.data as any || {};
                                playerData.target = socket;
                                playerSocket.data = playerData;

                                // Flush buffer if any
                                if (playerData.buffer && playerData.buffer.length > 0) {
                                    for (const chunk of playerData.buffer) {
                                        socket.write(chunk);
                                    }
                                    playerData.buffer = [];
                                }

                                this.log(`Tunnel linked for ${connId}`);
                            } else {
                                this.log(`Unknown connection ID: ${connId}`);
                                socket.end();
                            }
                            return;
                        }
                    }
                },
                close: (socket) => {
                    const state = socket.data as SocketState;
                    if (state.type === 'CONTROL') {
                        this.log('Agent Control Channel disconnected');
                        this.controlSocket = null;
                    }
                    if (state.type === 'DATA') {
                        state.target.end(); // Close the player connection too
                    }
                },
                error: (socket, err) => {
                    // Cleanup handled by close
                }
            }
        });

        // 2. Public Minecraft Server (Players connect here)
        Bun.listen({
            hostname: '0.0.0.0',
            port: this.config.publicPort,
            socket: {
                open: (playerSocket) => {
                    this.log(`Player connected: ${playerSocket.remoteAddress}`);

                    if (!this.controlSocket) {
                        this.log('No agent connected. Dropping player.');
                        playerSocket.end();
                        return;
                    }

                    // Generate ID
                    const connId = Math.random().toString(36).substring(7);
                    this.pendingPlayers.set(connId, playerSocket);

                    // Tell Agent to open a data connection
                    this.controlSocket.write(`CONNECT ${connId}\n`);

                    // We wait for the Agent to connect back to controlPort with "DATA <connId>"
                    // The linking happens in the Control Server logic above.
                },
                data: (playerSocket, data) => {
                    const target = (playerSocket.data as any)?.target as Socket;
                    if (target) {
                        target.write(data);
                    } else {
                        // Buffer? Or just drop for now (Handshake usually comes fast, but race condition possible)
                        // In a robust app, we buffer. For "Lite", we hope the agent connects fast enough (usually <10ms on localhost, <50ms internet)
                        // Minecraft client waits a bit before sending handshake? No, it sends immediately.
                        // WE MUST BUFFER.
                        const buffer = (playerSocket.data as any).buffer || [];
                        buffer.push(data);
                        (playerSocket.data as any).buffer = buffer;
                    }
                },
                close: (playerSocket) => {
                    const target = (playerSocket.data as any)?.target as Socket;
                    if (target) target.end();
                },
                drain: (playerSocket) => {
                    // Optional: handle backpressure
                }
            }
        });

        this.log(`Bridge Server running.`);
        this.log(`- Public (Players): :${this.config.publicPort}`);
        this.log(`- Control (Agent):  :${this.config.controlPort}`);
    }

    private log(msg: string) {
        if (this.config.debug) console.log(`[Bridge] ${msg}`);
    }
}
