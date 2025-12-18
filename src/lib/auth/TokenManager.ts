import { randomUUID, randomBytes } from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';

export interface TokenConfig {
    secret: string;
    tokenExpiryHours?: number;
    codeExpiryMinutes?: number;
    maxTokensPerAgent?: number;
}

export interface AgentToken {
    token: string;
    agentId: string;
    namespace: string;
    createdAt: Date;
    expiresAt: Date;
    isActive: boolean;
}

export interface ClaimCode {
    code: string;
    agentId: string;
    namespace: string;
    createdAt: Date;
    expiresAt: Date;
    isUsed: boolean;
}

export class TokenManager {
    private tokens = new Map<string, AgentToken>();
    private claimCodes = new Map<string, ClaimCode>();
    private config: TokenConfig;

    constructor(config: TokenConfig) {
        this.config = {
            tokenExpiryHours: 24,
            codeExpiryMinutes: 30,
            maxTokensPerAgent: 5,
            ...config
        };
    }

    /**
     * Generate a new claim code for an agent
     */
    generateClaimCode(agentId: string, namespace: string): string {
        // Clean up expired codes first
        this.cleanupExpiredCodes();

        // Generate a secure, user-friendly code
        const code = this.generateSecureCode();
        
        const claimCode: ClaimCode = {
            code,
            agentId,
            namespace,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + this.config.codeExpiryMinutes! * 60 * 1000),
            isUsed: false
        };

        this.claimCodes.set(code, claimCode);
        return code;
    }

    /**
     * Redeem a claim code for a token
     */
    redeemClaimCode(code: string): AgentToken | null {
        const claimCode = this.claimCodes.get(code);
        
        if (!claimCode || claimCode.isUsed || claimCode.expiresAt < new Date()) {
            return null;
        }

        // Mark code as used
        claimCode.isUsed = true;

        // Generate token
        const token = this.generateToken(claimCode.agentId, claimCode.namespace);
        return token;
    }

    /**
     * Generate a new token for an agent
     */
    generateToken(agentId: string, namespace: string): AgentToken {
        // Clean up expired tokens first
        this.cleanupExpiredTokens();

        // Check token limit per agent
        const agentTokens = Array.from(this.tokens.values())
            .filter(t => t.agentId === agentId && t.isActive);
        
        if (agentTokens.length >= this.config.maxTokensPerAgent!) {
            // Remove oldest token
            const oldestToken = agentTokens.sort((a, b) =>
                a.createdAt.getTime() - b.createdAt.getTime())[0];
            if (oldestToken) {
                this.tokens.delete(oldestToken.token);
            }
        }

        const expiryHours = this.config.tokenExpiryHours || 24; // Default to 24 hours
        const token: AgentToken = {
            token: this.generateSecureToken(),
            agentId,
            namespace,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000),
            isActive: true
        };

        this.tokens.set(token.token, token);
        return token;
    }

    /**
     * Validate a token
     */
    validateToken(token: string): AgentToken | null {
        const agentToken = this.tokens.get(token);
        
        if (!agentToken || !agentToken.isActive || agentToken.expiresAt < new Date()) {
            return null;
        }

        return agentToken;
    }

    /**
     * Revoke a token
     */
    revokeToken(token: string): boolean {
        const agentToken = this.tokens.get(token);
        if (agentToken) {
            agentToken.isActive = false;
            return true;
        }
        return false;
    }

    /**
     * Revoke all tokens for an agent
     */
    revokeAllTokens(agentId: string): number {
        let revoked = 0;
        for (const token of this.tokens.values()) {
            if (token.agentId === agentId && token.isActive) {
                token.isActive = false;
                revoked++;
            }
        }
        return revoked;
    }

    /**
     * Get all active tokens for an agent
     */
    getAgentTokens(agentId: string): AgentToken[] {
        return Array.from(this.tokens.values())
            .filter(t => t.agentId === agentId && t.isActive && t.expiresAt > new Date());
    }

    /**
     * Get token statistics
     */
    getStats() {
        const now = new Date();
        const activeTokens = Array.from(this.tokens.values())
            .filter(t => t.isActive && t.expiresAt > now);
        
        const activeCodes = Array.from(this.claimCodes.values())
            .filter(c => !c.isUsed && c.expiresAt > now);

        return {
            totalTokens: this.tokens.size,
            activeTokens: activeTokens.length,
            totalCodes: this.claimCodes.size,
            activeCodes: activeCodes.length,
            tokensByAgent: activeTokens.reduce((acc, token) => {
                acc[token.agentId] = (acc[token.agentId] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)
        };
    }

    private generateSecureCode(): string {
        // Generate a 6-character alphanumeric code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        const randomValues = randomBytes(6);
        for (let i = 0; i < 6; i++) {
            const byte = randomValues[i];
            if (byte !== undefined) {
                const charIndex = byte % chars.length;
                code += chars[charIndex];
            }
        }
        return code;
    }

    private generateSecureToken(): string {
        return randomUUID() + randomUUID(); // Double UUID for extra security
    }

    private cleanupExpiredTokens() {
        const now = new Date();
        for (const [token, agentToken] of this.tokens.entries()) {
            if (agentToken.expiresAt < now || !agentToken.isActive) {
                this.tokens.delete(token);
            }
        }
    }

    private cleanupExpiredCodes() {
        const now = new Date();
        for (const [code, claimCode] of this.claimCodes.entries()) {
            if (claimCode.expiresAt < now || claimCode.isUsed) {
                this.claimCodes.delete(code);
            }
        }
    }

    /**
     * Securely compare two tokens
     */
    static secureCompare(a: string, b: string): boolean {
        const bufferA = Buffer.from(a);
        const bufferB = Buffer.from(b);
        
        if (bufferA.length !== bufferB.length) {
            return false;
        }
        
        return timingSafeEqual(bufferA, bufferB);
    }
}