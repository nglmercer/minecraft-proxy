import type { Socket } from 'bun';

export interface BridgeConfig {
    port: number;
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
    buffer: Uint8Array[]; // Buffer for accumulating chunks
    connId?: string; // Track connId for cleanup
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
                    socket.data = { type: 'UNKNOWN', buffer: [] };
                },
                data: (socket, data) => {
                    const state = socket.data;

                    // 1. Fast Path: Tunnel Established
                    if (state.type === 'AGENT_DATA') {
                        state.target?.write(data);
                        return;
                    }

                    if (state.type === 'PLAYER') {
                        if (state.target) {
                            state.target.write(data);
                        } else {
                            // Buffer until tunnel is ready. Copy data!
                            state.buffer.push(new Uint8Array(data));
                        }
                        return;
                    }

                    if (state.type === 'AGENT_CONTROL') {
                        this.handleControlMessage(socket, data);
                        return;
                    }

                    // 2. Sniffing / Handshake Phase
                    if (state.type === 'UNKNOWN') {
                        // Accumulate data to handle split packets
                        state.buffer.push(new Uint8Array(data));

                        // Check combined buffer
                        const combined = Buffer.concat(state.buffer);

                        // Handle Proxy Protocol (Railway/Envoy etc)
                        let dataOffset = 0;
                        const proxyLen = this.getProxyHeaderLength(combined);

                        if (proxyLen === 0) return; // Wait for full proxy header
                        if (proxyLen > 0) {
                            dataOffset = proxyLen;
                        }

                        const effectiveBuffer = combined.subarray(dataOffset);

                        // Heuristic: Check for Agent Protocol Prefixes
                        // "DATA " or "AUTH "
                        // Also check for "PROXY " to avoid misclassifying fragmented proxy headers
                        if (effectiveBuffer.length < 6) {
                            const partial = effectiveBuffer.toString('utf8');
                            if ("DATA ".startsWith(partial) ||
                                "AUTH ".startsWith(partial) ||
                                "PROXY ".startsWith(partial)) {
                                return; // Wait for more data
                            }

                            // Check for v2 Proxy Signature (partial)
                            // Sig: 0D 0A 0D 0A 00 0D 0A 51 55 49 54 0A
                            const v2Sig = Buffer.from([0x0D, 0x0A, 0x0D, 0x0A, 0x00, 0x0D, 0x0A, 0x51, 0x55, 0x49, 0x54, 0x0A]);
                            if (effectiveBuffer.length > 0 && v2Sig.subarray(0, effectiveBuffer.length).equals(effectiveBuffer)) {
                                return; // Wait for more data
                            }

                            // Doesn't match prefix, assume Player
                            // We STRIP the PROXY header (if present) to ensure the local Minecraft server
                            // (which likely doesn't have proxy-protocol enabled) receives a clean stream.
                            this.convertToPlayer(socket, effectiveBuffer);
                            return;
                        }

                        const prefix = effectiveBuffer.subarray(0, 5).toString('utf8');

                        if (prefix === 'DATA ' || prefix === 'AUTH ') {
                            // It is Agent Protocol. Wait for newline.
                            const newlineIndex = effectiveBuffer.indexOf(10); // \n
                            if (newlineIndex === -1) {
                                return; // Wait for full command line
                            }

                            // We have a full command line
                            const commandLine = effectiveBuffer.subarray(0, newlineIndex).toString('utf8').trim();
                            // Use slice() to create a copy of the payload, ensuring it persists after buffer clear
                            const payload = effectiveBuffer.subarray(newlineIndex + 1).slice();

                            // Clear buffer (we consumed it)
                            state.buffer = [];

                            if (commandLine.startsWith('AUTH ')) {
                                state.type = 'AGENT_CONTROL';
                                this.processAuth(socket, commandLine);
                            } else if (commandLine.startsWith('DATA ')) {
                                this.processDataHandshake(socket, commandLine, payload);
                            }
                        } else {
                            // Not Agent Protocol -> Player
                            this.convertToPlayer(socket, effectiveBuffer);
                        }
                    }
                },
                close: (socket) => {
                    const state = socket.data;
                    if (state.type === 'AGENT_CONTROL') {
                        this.log('Agent Control disconnected');
                        this.controlSocket = null;
                    }
                    if (state.connId && this.pendingPlayers.has(state.connId)) {
                        this.log(`Player ${state.connId} disconnected before tunnel established`);
                        this.pendingPlayers.delete(state.connId);
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

    private convertToPlayer(socket: Socket<any>, initialData: Buffer) {
        this.log(`Detected: MINECRAFT PLAYER (${socket.remoteAddress})`);
        socket.data.type = 'PLAYER';
        // Keep the data in the buffer, it will be flushed when tunnel opens
        // But wait, we concatenated it for checking. We need to put it back in state.buffer?
        // Actually, state.buffer is Array<Uint8Array>.
        // If we called Buffer.concat, we created a new buffer.
        // Let's just reset state.buffer to contain this single combined chunk to avoid complexity.
        socket.data.buffer = [initialData];

        if (!this.controlSocket) {
            this.log('No agent connected. Dropping player.');
            socket.end();
            return;
        }

        const connId = Math.random().toString(36).substring(7);
        socket.data.connId = connId;
        this.pendingPlayers.set(connId, socket);
        this.controlSocket.write(`CONNECT ${connId}\n`);
    }

    private processAuth(socket: Socket<any>, commandLine: string) {
        const secret = commandLine.split(' ')[1];
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

    private processDataHandshake(socket: Socket<any>, commandLine: string, payload: Uint8Array) {
        const connId = commandLine.split(' ')[1];
        this.log(`Detected: AGENT DATA channel for ${connId}`);
        socket.data.type = 'AGENT_DATA';

        if (connId && this.pendingPlayers.has(connId)) {
            const playerSocket = this.pendingPlayers.get(connId)!;
            this.pendingPlayers.delete(connId);

            // Link
            socket.data.target = playerSocket;
            playerSocket.data.target = socket;
            playerSocket.data.type = 'PLAYER';

            // 1. Forward Payload (Agent -> Player)
            if (payload.length > 0) {
                this.log(`Forwarding ${payload.length} bytes of coalesced data to player`);
                playerSocket.write(payload);
            }

            // 2. Flush Player Buffer (Player -> Agent)
            const playerBuffer = playerSocket.data.buffer;
            if (playerBuffer.length > 0) {
                this.log(`Flushing ${playerBuffer.length} buffered packets for ${connId}`);
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
    }

    private handleControlMessage(socket: Socket<any>, data: Uint8Array) {
        // Only for subsequent control messages if any (currently none)
    }

    private log(msg: string) {
        if (this.config.debug) console.log(`[Bridge] ${msg}`);
    }

    private getProxyHeaderLength(buffer: Buffer): number {
        // v1: "PROXY "
        if (buffer.length >= 6 && buffer.subarray(0, 6).toString('utf8') === 'PROXY ') {
            const newline = buffer.indexOf(10); // \n
            if (newline !== -1) return newline + 1;
            return 0; // Incomplete
        }

        // v2: Sig
        const v2Sig = Buffer.from([0x0D, 0x0A, 0x0D, 0x0A, 0x00, 0x0D, 0x0A, 0x51, 0x55, 0x49, 0x54, 0x0A]);
        if (buffer.length >= 12 && buffer.subarray(0, 12).equals(v2Sig)) {
            if (buffer.length < 16) return 0; // Incomplete header
            const len = buffer.readUInt16BE(14);
            if (buffer.length < 16 + len) return 0; // Incomplete payload
            return 16 + len;
        }

        return -1; // Not a proxy header
    }
}
