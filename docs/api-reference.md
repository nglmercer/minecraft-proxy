# API Reference

This section details the internal classes and functions available for developers extending the library.

## Core Functions

### `startProxy(config?: Partial<ProxyConfig>)`

Starts the TCP proxy server.

-   **config**: Optional configuration object.
-   **Returns**: A `Bun.Listener` instance.

```typescript
import { startProxy } from 'minecraft-tcp-proxy';

const server = await startProxy({ proxyPort: 25566, minecraftPort: 25565 });
```

## Main Classes

### `ProxyServer`

The main proxy server class with support for multiple transport types and protocols.

```typescript
import { ProxyServer } from 'minecraft-tcp-proxy';

const server = new ProxyServer({
  proxyPort: 25566,
  minecraftHost: 'localhost',
  minecraftPort: 25565,
  transportType: 'tcp', // or 'udp'
  debug: true
});

await server.start();
```

### `BridgeServerEnhanced`

Enhanced bridge server with authentication and token management.

```typescript
import { BridgeServerEnhanced } from 'minecraft-tcp-proxy';

const bridge = new BridgeServerEnhanced({
  port: 8080,
  secret: 'my-secret-key',
  domain: 'bridge.example.com',
  debug: true,
  auth: {
    enabled: true,
    secret: 'auth-master-secret',
    tokenExpiryHours: 24,
    codeExpiryMinutes: 30,
    maxTokensPerAgent: 3
  }
});

bridge.start();

// Generate claim codes for agents
const code = bridge.generateClaimCode('agent-01', 'survival');
console.log('Claim code:', code);
```

### `TunnelAgent`

The client-side component for reverse tunneling.

```typescript
const agent = new TunnelAgent({
    bridgeHost: 'example.com',
    bridgeControlPort: 8080,
    localHost: 'localhost',
    localPort: 25565,
    secret: 'my-secret'
});
agent.start();
```

### `BridgeServer`

The original bridge server (legacy, use BridgeServerEnhanced for new projects).

```typescript
const bridge = new BridgeServer({
    publicPort: 25565,
    controlPort: 8080,
    secret: 'my-secret'
});
bridge.start();
```

### `TokenManager`

Manages authentication tokens and claim codes for enhanced security.

```typescript
import { TokenManager } from 'minecraft-tcp-proxy';

const tokenManager = new TokenManager({
  secret: 'auth-secret',
  tokenExpiryHours: 24,
  codeExpiryMinutes: 30,
  maxTokensPerAgent: 5
});

// Generate claim code
const code = tokenManager.generateClaimCode('agent-01', 'survival');

// Redeem claim code for token
const token = tokenManager.redeemClaimCode(code);

// Validate token
const isValid = tokenManager.validateToken(token.token);
```

## Transport Layer

### `Transport` Interface

Abstract interface for network transports.

```typescript
interface Transport {
  listen(port: number, host?: string): Promise<void>;
  onConnection(listener: (connection: Connection) => void): void;
  close(): void;
}
```

### `TcpTransport`

TCP transport implementation.

```typescript
import { TcpTransport } from 'minecraft-tcp-proxy';

const transport = new TcpTransport();
await transport.listen(25565);
```

### `UdpTransport`

UDP transport implementation.

```typescript
import { UdpTransport } from 'minecraft-tcp-proxy';

const transport = new UdpTransport();
await transport.listen(25565);
```

## Protocol Layer

### `Protocol` Interface

Abstract interface for packet protocols.

```typescript
interface Protocol {
  parse(buffer: Uint8Array): Packet | null;
}
```

### `MinecraftProtocol`

Minecraft protocol implementation for handshake parsing.

```typescript
import { MinecraftProtocol } from 'minecraft-tcp-proxy';

const protocol = new MinecraftProtocol();
const packet = protocol.parse(buffer);
```

### `PassthroughProtocol`

Simple passthrough protocol that doesn't parse packets.

```typescript
import { PassthroughProtocol } from 'minecraft-tcp-proxy';

const protocol = new PassthroughProtocol();
```

## Configuration

### `ConfigManager`

Advanced configuration management with file watching and validation.

```typescript
import { ConfigManager } from 'minecraft-tcp-proxy';

const manager = new ConfigManager({
  fileName: 'config.yaml',
  defaultConfig: {
    host: 'localhost',
    port: 8080,
    debug: false
  },
  validator: (config) => {
    if (config.port < 1024) {
      return 'Port must be >= 1024';
    }
    return true;
  }
});

const config = await manager.load();
```

## Utilities

### `VarInt`

Utilities for reading/writing Minecraft VarInts.

-   `readVarIntSync(buffer, offset)`
-   `writeVarIntSync(buffer, value, offset)`
-   `varIntLength(value)`

### `Handshake`

-   `parseHandshake(buffer)`: Decodes the initial Minecraft handshake packet.

### `BridgeManager`

Manages multiple bridge instances.

```typescript
import { BridgeManager } from 'minecraft-tcp-proxy';

const manager = new BridgeManager();
manager.startBridge('main', config);
```
