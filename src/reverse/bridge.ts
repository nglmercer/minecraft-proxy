import type { Socket } from 'bun';

export interface BridgeConfig {
    port: number; // Single port for both Agent and Players
    secret: string;
    debug?: boolean;
}

export const defaultBridgeConfig: BridgeConfig = {
    port: 8080,
    secret: 'default-secret',
    debug: false
};

type SocketType = 'UNKNOWN' | 'AGENT_CONTROL' | 'AGENT_DATA' | 'PLAYER';

interface SocketData {
    type: SocketType;
    authenticated?: boolean;
    target?: Socket;
    buffer: Uint8Array[]; // Buffer vital to not lose the first player packet
}

export class BridgeServer {
    private config: BridgeConfig;
    private controlSocket: Socket<any> | null = null;
    private pendingPlayers = new Map<string, Socket<any>>();

    constructor(config: BridgeConfig) {
        this.config = config;
    }

    start() {
        this.log(`Starting Bridge on port ${this.config.port} (MULTIPLEXED MODE)...`);

        Bun.listen<SocketData>({
            hostname: '0.0.0.0',
            port: this.config.port,
            socket: {
                open: (socket) => {
                    // On open, we don't know who it is. Wait for first packet.
                    socket.data = { type: 'UNKNOWN', buffer: [] };
                },
                data: (socket, data) => {
                    const state = socket.data;

                    // 1. If we already know who it is, act normally
                    if (state.type === 'AGENT_DATA') {
                        state.target?.write(data);
                        return;
                    }

                    if (state.type === 'PLAYER') {
                        // If it's a player, send to agent socket (DATA channel)
                        state.target?.write(data);
                        return;
                    }

                    if (state.type === 'AGENT_CONTROL') {
                        this.handleControlMessage(socket, data);
                        return;
                    }

                    // 2. If UNKNOWN, analyze the first packet (Sniffing)
                    if (state.type === 'UNKNOWN') {
                        const msg = data.toString();

                        // -- AGENT DETECTION (Text Protocol) --
                        if (msg.startsWith('AUTH ')) {
                            this.log('Detected: AGENT CONTROL requesting handshake');
                            state.type = 'AGENT_CONTROL';
                            this.handleControlMessage(socket, data); // Process the AUTH
                            return;
                        }

                        if (msg.startsWith('DATA ')) {
                            // DATA <connId>
                            const connId = msg.trim().split(' ')[1];
                            this.log(`Detected: AGENT DATA channel for ${connId}`);
                            state.type = 'AGENT_DATA';

                            if (connId && this.pendingPlayers.has(connId)) {
                                const playerSocket = this.pendingPlayers.get(connId)!;
                                this.pendingPlayers.delete(connId);

                                // Link Player <-> AgentData
                                state.target = playerSocket;
                                playerSocket.data.target = socket;
                                playerSocket.data.type = 'PLAYER'; // Confirm the other was player

                                // Flush player buffer if data was waiting
                                const playerBuffer = playerSocket.data.buffer;
                                if (playerBuffer.length > 0) {
                                    for (const chunk of playerBuffer) {
                                        socket.write(chunk);
                                    }
                                    playerSocket.data.buffer = [];
                                }

                                this.log(`Tunnel established for ${connId}`);
                            } else {
                                this.log(`Invalid connId or player gone: ${connId}`);
                                socket.end();
                            }
                            return;
                        }

                        // -- PLAYER DETECTION (Anything else) --
                        // If not AUTH nor DATA, assume it's Minecraft.
                        this.log(`Detected: MINECRAFT PLAYER (${socket.remoteAddress})`);
                        state.type = 'PLAYER';

                        // Save this first packet in buffer because tunnel isn't ready
                        state.buffer.push(data);

                        if (!this.controlSocket) {
                            this.log('No agent connected. Dropping player.');
                            socket.end();
                            return;
                        }

                        // Generate ID and ask Agent for tunnel
                        const connId = Math.random().toString(36).substring(7);
                        this.pendingPlayers.set(connId, socket);
                        this.controlSocket.write(`CONNECT ${connId}\n`);
                    }
                },
                close: (socket) => {
                    const state = socket.data;
                    if (state.type === 'AGENT_CONTROL') {
                        this.log('Agent Control disconnected');
                        this.controlSocket = null;
                    }
                    if (state.target) {
                        state.target.end();
                    }
                },
                error: (socket) => {
                    socket.end();
                }
            }
        });
    }

    private handleControlMessage(socket: Socket<any>, data: Uint8Array) {
        const msg = data.toString();
        // Authentication logic
        if (msg.startsWith('AUTH ')) {
            const secret = msg.trim().split(' ')[1];
            if (secret === this.config.secret) {
                socket.data.authenticated = true;
                this.controlSocket = socket;
                this.log('Agent authenticated successfully');
                socket.write('AUTH_OK\n');
            } else {
                socket.write('AUTH_FAIL\n');
                socket.end();
            }
        }
        // ... other control logic if any ...
    }

    private log(msg: string) {
        if (this.config.debug) console.log(`[Bridge] ${msg}`);
    }
}
