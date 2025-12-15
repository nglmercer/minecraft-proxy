import type { Socket } from 'bun';
import { randomUUID, timingSafeEqual } from 'node:crypto';

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
    target?: Socket<SocketData>;
    buffer: Uint8Array[]; // Buffer for accumulating chunks
    connId?: string; // Track connId for cleanup
    handshakeTimeout?: Timer;
    pendingTimeout?: Timer;
}

const MAX_BUFFER_SIZE = 4096;
const HANDSHAKE_TIMEOUT_MS = 5000;

// Rate Limiting Config
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_LOCKOUT_MS = 60_000; // 1 minute lockout
const MAX_CONN_PER_IP_SEC = 10; // 10 connections per second per IP (Player flood protection)

interface IpState {
    authFailures: number;
    lockoutUntil: number;
    connectionsThisSecond: number;
    lastConnectionTime: number;
}

export class BridgeServer {
    private config: BridgeConfig;
    private controlSocket: Socket<SocketData> | null = null;
    private pendingPlayers = new Map<string, Socket<SocketData>>();
    private ipStates = new Map<string, IpState>();

    constructor(config: BridgeConfig) {
        this.config = config;
    }

    start() {
        this.log(`Starting Bridge on port ${this.config.port} (MULTIPLEXED MODE)...`);

        // Clean up IP states periodically
        setInterval(() => this.cleanupIpStates(), 60_000);

        Bun.listen<SocketData>({
            hostname: '0.0.0.0',
            port: this.config.port,
            socket: {
                open: (socket) => {
                    const remoteIp = socket.remoteAddress;
                    
                    // 1. Check Rate Limits
                    if (!this.checkConnectionRateLimit(remoteIp)) {
                        this.log(`Rate limit exceeded for ${remoteIp}. Dropping connection.`);
                        socket.end();
                        return;
                    }

                    const timeout = setTimeout(() => {
                        this.log(`Connection timed out awaiting protocol identification: ${socket.remoteAddress}`);
                        socket.end();
                    }, HANDSHAKE_TIMEOUT_MS);

                    socket.data = { type: 'UNKNOWN', buffer: [], handshakeTimeout: timeout };
                },
                data: (socket, data) => {
                    const state = socket.data;

                    if (state.type === 'AGENT_DATA') {
                        state.target?.write(data);
                        return;
                    }

                    if (state.type === 'PLAYER') {
                        if (state.target) {
                            state.target.write(data);
                        } else {
                            state.buffer.push(Buffer.from(data));
                        }
                        return;
                    }

                    if (state.type === 'AGENT_CONTROL') {
                        this.handleControlMessage(socket, data);
                        return;
                    }

                    if (state.type === 'UNKNOWN') {
                        const currentSize = state.buffer.reduce((acc, chunk) => acc + chunk.length, 0);
                        if (currentSize + data.length > MAX_BUFFER_SIZE) {
                            this.log(`Connection exceeded buffer limit during handshake: ${socket.remoteAddress}`);
                            socket.end();
                            return;
                        }

                        state.buffer.push(Buffer.from(data));
                        const combined = Buffer.concat(state.buffer);

                        let dataOffset = 0;
                        const proxyLen = this.getProxyHeaderLength(combined);

                        if (proxyLen === 0) return; 
                        if (proxyLen > 0) {
                            dataOffset = proxyLen;
                        }

                        const effectiveBuffer = combined.subarray(dataOffset);

                        if (effectiveBuffer.length < 6) {
                            const partial = effectiveBuffer.toString('utf8');
                            if ("DATA ".startsWith(partial) || "AUTH ".startsWith(partial) || "PROXY ".startsWith(partial)) {
                                return;
                            }
                            const v2Sig = Buffer.from([0x0D, 0x0A, 0x0D, 0x0A, 0x00, 0x0D, 0x0A, 0x51, 0x55, 0x49, 0x54, 0x0A]);
                            if (effectiveBuffer.length > 0 && v2Sig.subarray(0, effectiveBuffer.length).equals(effectiveBuffer)) {
                                return;
                            }
                            
                            this.convertToPlayer(socket, effectiveBuffer);
                            return;
                        }

                        const prefix = effectiveBuffer.subarray(0, 5).toString('utf8');

                        if (prefix === 'DATA ' || prefix === 'AUTH ') {
                            const newlineIndex = effectiveBuffer.indexOf(10);
                            if (newlineIndex === -1) {
                                return;
                            }

                            const commandLine = effectiveBuffer.subarray(0, newlineIndex).toString('utf8').trim();
                            const payload = effectiveBuffer.subarray(newlineIndex + 1).slice();

                            state.buffer = [];
                            this.clearHandshakeTimeout(socket);

                            if (commandLine.startsWith('AUTH ')) {
                                state.type = 'AGENT_CONTROL';
                                this.processAuth(socket, commandLine);
                            } else if (commandLine.startsWith('DATA ')) {
                                this.processDataHandshake(socket, commandLine, payload);
                            }
                        } else {
                            this.convertToPlayer(socket, effectiveBuffer);
                        }
                    }
                },
                close: (socket) => {
                    this.clearHandshakeTimeout(socket);
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
                    this.clearHandshakeTimeout(socket);
                    socket.end();
                }
            }
        });
    }

    private checkConnectionRateLimit(ip: string): boolean {
        const now = Date.now();
        let state = this.ipStates.get(ip);
        if (!state) {
            state = { authFailures: 0, lockoutUntil: 0, connectionsThisSecond: 0, lastConnectionTime: now };
            this.ipStates.set(ip, state);
        }

        if (state.lockoutUntil > now) {
            return false;
        }

        if (now - state.lastConnectionTime < 1000) {
            state.connectionsThisSecond++;
        } else {
            state.connectionsThisSecond = 1;
            state.lastConnectionTime = now;
        }

        if (state.connectionsThisSecond > MAX_CONN_PER_IP_SEC) {
            return false;
        }

        return true;
    }

    private cleanupIpStates() {
        const now = Date.now();
        for (const [ip, state] of this.ipStates.entries()) {
            if (state.lockoutUntil < now && (now - state.lastConnectionTime > 60000)) {
                this.ipStates.delete(ip);
            }
        }
    }

    private clearHandshakeTimeout(socket: Socket<SocketData>) {
        if (socket.data && socket.data.handshakeTimeout) {
            clearTimeout(socket.data.handshakeTimeout);
            socket.data.handshakeTimeout = undefined;
        }
    }

    private convertToPlayer(socket: Socket<SocketData>, initialData: Buffer) {
        this.clearHandshakeTimeout(socket);
        this.log(`Detected: MINECRAFT PLAYER (${socket.remoteAddress})`);
        
        if (this.pendingPlayers.size > 1000) {
             this.log('Too many pending players. Dropping.');
             socket.end();
             return;
        }

        socket.data.type = 'PLAYER';
        socket.data.buffer = [initialData];

        if (!this.controlSocket) {
            this.log('No agent connected. Dropping player.');
            socket.end();
            return;
        }

        const connId = randomUUID();
        socket.data.connId = connId;

        // Set pending timeout
        socket.data.pendingTimeout = setTimeout(() => {
            if (this.pendingPlayers.has(connId)) {
                this.log(`Pending connection ${connId} timed out waiting for agent.`);
                this.pendingPlayers.delete(connId);
                socket.end();
            }
        }, 10000); // 10s timeout

        this.pendingPlayers.set(connId, socket);
        this.controlSocket.write(`CONNECT ${connId}\n`);
    }

    private processAuth(socket: Socket<SocketData>, commandLine: string) {
        const remoteIp = socket.remoteAddress;
        
        const state = this.ipStates.get(remoteIp)!;
        if (state.lockoutUntil > Date.now()) {
            socket.write('AUTH_FAIL_LOCKED\n');
            socket.end();
            return;
        }

        const parts = commandLine.split(' ');
        if (parts.length < 2) {
             socket.write('AUTH_FAIL\n');
             socket.end();
             return;
        }
        const providedSecret = parts[1] || '';
        
        const secretBuf = Buffer.from(this.config.secret);
        const providedBuf = Buffer.from(providedSecret);
        
        let valid = false;
        try {
            if (secretBuf.length === providedBuf.length) {
                valid = timingSafeEqual(secretBuf, providedBuf);
            }
        } catch (e) {
            valid = false;
        }

        if (valid) {
            state.authFailures = 0;
            
            socket.data.authenticated = true;
            this.controlSocket = socket;
            this.log('Agent authenticated successfully');
            socket.write('AUTH_OK\n');
        } else {
            state.authFailures++;
            if (state.authFailures >= MAX_AUTH_ATTEMPTS) {
                this.log(`Blocking IP ${remoteIp} due to multiple auth failures`);
                state.lockoutUntil = Date.now() + AUTH_LOCKOUT_MS;
            }
            
            socket.write('AUTH_FAIL\n');
            socket.end();
        }
    }

    private processDataHandshake(socket: Socket<SocketData>, commandLine: string, payload: Uint8Array) {
        const connId = commandLine.split(' ')[1];
        this.log(`Detected: AGENT DATA channel for ${connId}`);
        socket.data.type = 'AGENT_DATA';

        if (connId && this.pendingPlayers.has(connId)) {
            const playerSocket = this.pendingPlayers.get(connId)!;
            this.pendingPlayers.delete(connId);
            
            // Clear Pending Timeout
            if (playerSocket.data.pendingTimeout) {
                clearTimeout(playerSocket.data.pendingTimeout);
                playerSocket.data.pendingTimeout = undefined;
            }

            socket.data.target = playerSocket;
            playerSocket.data.target = socket;
            playerSocket.data.type = 'PLAYER';

            if (payload.length > 0) {
                this.log(`Forwarding ${payload.length} bytes of coalesced data to player`);
                playerSocket.write(payload);
            }

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

    private handleControlMessage(socket: Socket<SocketData>, data: Uint8Array) {
        // Only for subsequent control messages if any
    }

    private log(msg: string) {
        if (this.config.debug) console.log(`[Bridge] ${msg}`);
    }

    private getProxyHeaderLength(buffer: Buffer): number {
        if (buffer.length >= 6 && buffer.subarray(0, 6).toString('utf8') === 'PROXY ') {
            const newline = buffer.indexOf(10);
            if (newline !== -1) return newline + 1;
            return 0;
        }

        const v2Sig = Buffer.from([0x0D, 0x0A, 0x0D, 0x0A, 0x00, 0x0D, 0x0A, 0x51, 0x55, 0x49, 0x54, 0x0A]);
        if (buffer.length >= 12 && buffer.subarray(0, 12).equals(v2Sig)) {
            if (buffer.length < 16) return 0;
            const len = buffer.readUInt16BE(14);
            if (buffer.length < 16 + len) return 0;
            return 16 + len;
        }

        return -1;
    }
}
