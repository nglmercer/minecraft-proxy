import type { Socket } from 'bun';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { parseHandshake } from '../../core/handshake.js';
import { globalMetrics } from '../metrics/MetricsRegistry.js';
import { TokenManager, type TokenConfig } from '../auth/TokenManager.js';

export interface BridgeConfigEnhanced extends BridgeConfig {
    auth?: {
        enabled: boolean;
        secret: string;
        tokenExpiryHours?: number;
        codeExpiryMinutes?: number;
        maxTokensPerAgent?: number;
    };
}

export interface BridgeConfig {
    port: number;
    secret: string;
    debug?: boolean;
    domain?: string;
}

export const defaultBridgeConfig: BridgeConfig = {
    port: 8080,
    secret: 'default-secret',
    debug: false,
    domain: 'localhost'
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
    agentId?: string; // The ID/Subdomain of the agent this socket belongs to
}

const MAX_BUFFER_SIZE = 4096;
const HANDSHAKE_TIMEOUT_MS = 5000;

// Rate Limiting Config
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_LOCKOUT_MS = 60_000; // 1 minute lockout
const MAX_CONN_PER_IP_SEC = 20; 

interface IpState {
    authFailures: number;
    lockoutUntil: number;
    connectionsThisSecond: number;
    lastConnectionTime: number;
}

export class BridgeServerEnhanced {
    private config: BridgeConfigEnhanced;
    // Map subdomain/agentId -> Agent Control Socket
    private agents = new Map<string, Socket<SocketData>>(); 
    private pendingPlayers = new Map<string, Socket<SocketData>>();
    private ipStates = new Map<string, IpState>();
    private tokenManager: TokenManager | null = null;

    constructor(config: BridgeConfigEnhanced) {
        this.config = config;
        this.initMetrics();
        
        // Initialize token manager if auth is enabled
        if (config.auth?.enabled) {
            this.tokenManager = new TokenManager({
                secret: config.auth.secret,
                tokenExpiryHours: config.auth.tokenExpiryHours,
                codeExpiryMinutes: config.auth.codeExpiryMinutes,
                maxTokensPerAgent: config.auth.maxTokensPerAgent
            });
        }
    }

    private initMetrics() {
        globalMetrics.registerCounter('bridge_connections_total', 'Total connections accepted');
        globalMetrics.registerCounter('bridge_agents_connected', 'Current connected agents');
        globalMetrics.registerCounter('bridge_players_connected', 'Current connected players');
    }

    start() {
        const authStatus = this.tokenManager ? 'AUTH-ENABLED' : 'AUTH-DISABLED';
        this.log(`Starting Enhanced Bridge on port ${this.config.port} (${authStatus})...`);

        // Clean up IP states periodically
        setInterval(() => this.cleanupIpStates(), 60_000);

        Bun.listen<SocketData>({
            hostname: '0.0.0.0',
            port: this.config.port,
            socket: {
                open: (socket) => {
                    globalMetrics.increment('bridge_connections_total');
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
                        if (state.target) {
                            state.target.write(data);
                        }
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

                        if (proxyLen === 0) return; // Incomplete PROXY header
                        if (proxyLen > 0) {
                            dataOffset = proxyLen;
                        }

                        const effectiveBuffer = combined.subarray(dataOffset);

                        if (effectiveBuffer.length < 6) {
                            // Check for HAProxy V2 signature start or text commands
                            const partial = effectiveBuffer.toString('utf8');
                            if ("DATA ".startsWith(partial) || "AUTH ".startsWith(partial)) {
                                return; 
                            }
                            // HAProxy V2 signature check
                            const v2Sig = Buffer.from([0x0D, 0x0A, 0x0D, 0x0A, 0x00, 0x0D, 0x0A, 0x51, 0x55, 0x49, 0x54, 0x0A]);
                            if (effectiveBuffer.length > 0 && v2Sig.subarray(0, effectiveBuffer.length).equals(effectiveBuffer)) {
                                return;
                            }
                            
                            // If we have enough data to try parsing handshake, proceed. 
                            // Minecraft Packet Length + ID 0x00. VarInt(Len) + VarInt(ID) = at least 2 bytes.
                            if (effectiveBuffer.length > 2) {
                                this.convertToPlayer(socket, effectiveBuffer);
                                return;
                            }
                            return; // Wait for more data
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
                        if (state.agentId) {
                            this.log(`Agent ${state.agentId} disconnected`);
                            this.agents.delete(state.agentId);
                            globalMetrics.increment('bridge_agents_connected', { agent: state.agentId }, -1);
                        }
                    }
                    if (state.connId && this.pendingPlayers.has(state.connId)) {
                        this.log(`Player ${state.connId} disconnected before tunnel established`);
                        this.pendingPlayers.delete(state.connId);
                    }
                    if (state.target) {
                        state.target.end();
                    }
                    if (state.type === 'PLAYER') {
                        globalMetrics.increment('bridge_players_connected', {}, -1);
                    }
                },
                error: (socket) => {
                    this.clearHandshakeTimeout(socket);
                    socket.end();
                }
            }
        });
    }

    stop() {
        this.log('Stopping Enhanced Bridge...');
        
        // Close all agent connections
        for (const [agentId, socket] of this.agents.entries()) {
            socket.end();
        }
        this.agents.clear();

        // Close all pending player connections
        for (const [connId, socket] of this.pendingPlayers.entries()) {
            socket.end();
        }
        this.pendingPlayers.clear();

        this.log('Enhanced Bridge stopped');
    }

    /**
     * Generate a claim code for a new agent
     */
    generateClaimCode(agentId: string, namespace: string): string {
        if (!this.tokenManager) {
            // Generate a simple claim code when auth is disabled
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        }
        return this.tokenManager.generateClaimCode(agentId, namespace);
    }

    /**
     * Redeem a claim code and return the token
     */
    redeemClaimCode(code: string): { token: string; agentId: string; namespace: string } | null {
        if (!this.tokenManager) {
            throw new Error('Token manager not initialized - auth is disabled');
        }
        const token = this.tokenManager.redeemClaimCode(code);
        if (token) {
            return {
                token: token.token,
                agentId: token.agentId,
                namespace: token.namespace
            };
        }
        return null;
    }

    /**
     * Get token statistics
     */
    getTokenStats() {
        if (!this.tokenManager) {
            return {
                enabled: false,
                activeTokens: 0,
                activeClaimCodes: 0,
                totalTokensGenerated: 0,
                totalClaimCodesGenerated: 0
            };
        }
        return {
            enabled: true,
            ...this.tokenManager.getStats()
        };
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
        // Try to parse handshake to find target agent
        let targetAgentId: string | null = null;
        
        try {
            const { handshake } = parseHandshake(initialData);
            const host = handshake.serverAddress;
            // logic to extract subdomain:
            // e.g. "agent1.bridge.com" -> "agent1"
            if (this.config.domain) {
                const parts = host.split('.');
                // Simple heuristic: subdomain is the first part if it ends with domain
                // If config.domain is "bridge.example.com", and host is "test.bridge.example.com", subdomain is "test".
                if (host.endsWith(this.config.domain)) {
                    const prefix = host.slice(0, -(this.config.domain.length + 1)); // +1 for dot
                    if (prefix && !prefix.includes('.')) {
                        targetAgentId = prefix;
                    }
                }
            } else {
                // Fallback: If no base domain configured, maybe use the whole host or first part?
                // For safety, let requires explicit domain config for routing or use Map defaults
                targetAgentId = host.split('.')[0] || null;
            }
        } catch (e) {
            this.log(`Failed to parse handshake from ${socket.remoteAddress}: ${e}`);
            // If it's not a valid Minecraft handshake, treat it as a simple connection
            // Use the first connected agent as default
            if (this.agents.size > 0) {
                const firstAgent = Array.from(this.agents.keys())[0];
                if (firstAgent) {
                    targetAgentId = firstAgent;
                    this.log(`Using default agent '${targetAgentId}' for non-Minecraft connection`);
                }
            }
        }

        if (!targetAgentId) {
             this.log(`Could not determine target agent for ${socket.remoteAddress}. Host sniffing failed.`);
             // Maybe fallback to a default agent?
             if (this.agents.has('default')) {
                 targetAgentId = 'default';
             } else if (this.agents.size > 0) {
                 // Use first available agent
                 const firstAgent = Array.from(this.agents.keys())[0];
                 if (firstAgent) {
                     targetAgentId = firstAgent;
                     this.log(`Using first available agent '${targetAgentId}' as fallback`);
                 }
             } else {
                 socket.end();
                 return;
             }
        }

        if (!targetAgentId) {
            socket.end();
            return;
        }

        const agentSocket = this.agents.get(targetAgentId);

        if (!agentSocket) {
            this.log(`Agent '${targetAgentId}' not connected. Dropping player.`);
            socket.end();
            return;
        }

        this.log(`Detected: MINECRAFT PLAYER (${socket.remoteAddress}) -> Route to Agent: ${targetAgentId}`);
        
        if (this.pendingPlayers.size > 1000) {
             this.log('Too many pending players. Dropping.');
             socket.end();
             return;
        }

        socket.data.type = 'PLAYER';
        socket.data.buffer = [initialData];
        globalMetrics.increment('bridge_players_connected');

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
        agentSocket.write(`CONNECT ${connId}\n`);
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
        
        if (this.tokenManager) {
            // Enhanced authentication with tokens
            this.processAuthWithTokens(socket, commandLine, parts);
        } else {
            // Original authentication with shared secret
            this.processAuthWithSecret(socket, commandLine, parts, state);
        }
    }

    private processAuthWithTokens(socket: Socket<SocketData>, commandLine: string, parts: string[]) {
        // Expected: AUTH <token_or_code> [subdomain]
        if (parts.length < 2) {
            socket.write('AUTH_FAIL_INVALID_FORMAT\n');
            socket.end();
            return;
        }

        const providedToken = parts[1] || '';
        const requestedSubdomain = parts[2];

        // First try to validate as a token
        const token = this.tokenManager!.validateToken(providedToken);
        
        if (token) {
            // Valid token authentication
            this.completeAuth(socket, token.agentId, token.namespace);
            return;
        }

        // If not a valid token, try as a claim code
        const redeemed = this.tokenManager!.redeemClaimCode(providedToken);
        
        if (redeemed) {
            // Valid claim code, generate new token
            const newToken = this.tokenManager!.generateToken(redeemed.agentId, redeemed.namespace);
            this.completeAuth(socket, newToken.agentId, newToken.namespace);
            socket.write(`AUTH_OK ${newToken.agentId}.${newToken.namespace} ${newToken.token}\n`);
            return;
        }

        // Invalid credentials
        socket.write('AUTH_FAIL_INVALID_CREDENTIALS\n');
        socket.end();
    }

    private processAuthWithSecret(socket: Socket<SocketData>, commandLine: string, parts: string[], state: IpState) {
        // Expected: AUTH <secret> [subdomain]
        if (parts.length < 2) {
             socket.write('AUTH_FAIL\n');
             socket.end();
             return;
        }
        const providedSecret = parts[1] || '';
        // If no subdomain provided, generate a random short one
        const requestedSubdomain = parts[2] || randomUUID().substring(0, 8);

        
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
            if (this.agents.has(requestedSubdomain)) {
                 this.log(`Agent attempted to claim already active subdomain '${requestedSubdomain}'. Rejecting.`);
                 socket.write('AUTH_FAIL_IN_USE\n');
                 socket.end();
                 return;
            }

            state.authFailures = 0;
            
            socket.data.authenticated = true;
            socket.data.agentId = requestedSubdomain;
            this.agents.set(requestedSubdomain, socket);
            
            this.log(`Agent authenticated successfully as '${requestedSubdomain}'`);
            globalMetrics.increment('bridge_agents_connected');
            socket.write(`AUTH_OK ${requestedSubdomain}.bridge\n`);
        } else {
            state.authFailures++;
            if (state.authFailures >= MAX_AUTH_ATTEMPTS) {
                this.log(`Blocking IP ${socket.remoteAddress} due to multiple auth failures`);
                state.lockoutUntil = Date.now() + AUTH_LOCKOUT_MS;
            }
            
            socket.write('AUTH_FAIL\n');
            socket.end();
        }
    }

    private completeAuth(socket: Socket<SocketData>, agentId: string, namespace: string) {
        // Check if agent is already connected
        if (this.agents.has(agentId)) {
            socket.write('AUTH_FAIL_AGENT_ALREADY_CONNECTED\n');
            socket.end();
            return;
        }

        socket.data.authenticated = true;
        socket.data.agentId = agentId;
        this.agents.set(agentId, socket);
        
        this.log(`Agent authenticated successfully: ${agentId}.${namespace}`);
        globalMetrics.increment('bridge_agents_connected');
        socket.write(`AUTH_OK ${agentId}.${namespace}\n`);
    }

    private processDataHandshake(socket: Socket<SocketData>, commandLine: string, payload: Uint8Array) {
        const connId = commandLine.split(' ')[1];
        if(!connId) {
            socket.end();
            return;
        }
        this.log(`Detected: AGENT DATA channel for ${connId}`);
        socket.data.type = 'AGENT_DATA';

        if (this.pendingPlayers.has(connId)) {
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
            socket.data.connId = connId;

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
        const authStatus = this.tokenManager ? 'AUTH-ENABLED' : 'AUTH-DISABLED';
        console.log(`[Bridge:${authStatus}] ${msg}`);
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
