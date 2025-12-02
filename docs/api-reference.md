# API Reference

This section details the internal classes and functions available for developers extending the library.

## Core Functions

### `startProxy(config?: Partial<ProxyConfig>)`

Starts the TCP proxy server.

-   **config**: Optional configuration object.
-   **Returns**: A `Bun.Listener` instance.

```typescript
import { startProxy } from 'minecraft-tcp-proxy';

const server = await startProxy({ listenPort: 25566, backendPort: 25565 });
```

## Classes

### `ConnectionHandler`

Manages the lifecycle of a single client connection.

-   **`handleClientData(client: Socket, data: Buffer)`**: Processes incoming data. Buffers until handshake is parsed, then forwards.
-   **`handleClientClose(client: Socket)`**: Cleans up resources on disconnect.
-   **`handleClientError(client: Socket, error: Error)`**: Handles errors.

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

The server-side component for reverse tunneling.

```typescript
const bridge = new BridgeServer({
    publicPort: 25565,
    controlPort: 8080,
    secret: 'my-secret'
});
bridge.start();
```

## Utilities

### `VarInt`

Utilities for reading/writing Minecraft VarInts.

-   `readVarIntSync(buffer, offset)`
-   `writeVarIntSync(buffer, value, offset)`
-   `varIntLength(value)`

### `Handshake`

-   `parseHandshake(buffer)`: Decodes the initial Minecraft handshake packet.
