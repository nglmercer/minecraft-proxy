export * from './config/config.js';
export * from './config/config-manager.js';
// export * from './connection-handler.js'; // Deprecated/Replaced
export * from './core/handshake.js';
export * from './core/proxy.js';
export * from './core/tunnel.js';
export * from './core/varint.js';
export * from './core/types.js';
export * from './reverse/agent.js';
export * from './reverse/bridge.js';
export * from './core/ProxyServer.js';
export * from './transports/Transport.js';
export * from './transports/TcpTransport.js';
export * from './transports/UdpTransport.js';
export * from './protocols/Protocol.js';
export * from './protocols/MinecraftProtocol.js';
export * from './protocols/PassthroughProtocol.js';

// Bridge components with enhanced authentication
export { BridgeServer, defaultBridgeConfig } from './lib/bridge/BridgeServer.js';
export type { BridgeConfig } from './lib/bridge/BridgeServer.js';
export { BridgeServerEnhanced } from './lib/bridge/BridgeServerEnhanced.js';
export type { BridgeConfigEnhanced } from './lib/bridge/BridgeServerEnhanced.js';
export { TunnelAgent, defaultAgentConfig } from './lib/bridge/TunnelAgent.js';
export type { AgentConfig } from './lib/bridge/TunnelAgent.js';
export { BridgeManager, defaultBridgeManager } from './lib/bridge/BridgeManager.js';
export { TokenManager } from './lib/auth/TokenManager.js';
export type { TokenConfig, AgentToken, ClaimCode } from './lib/auth/TokenManager.js';
