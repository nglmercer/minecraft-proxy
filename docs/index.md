# Minecraft TCP Proxy (Lite Mode)

## Overview

This project implements a lightweight TCP proxy for Minecraft using Bun. It works in "Lite Mode", which simply tunnels traffic between the client and the backend server after forwarding the initial handshake packet. No packet decoding, state tracking, or permission management is performed, resulting in minimal overhead and a simple codebase.

## Architecture

### High-level Flow

```mermaid
graph LR
    A["Minecraft Client"] -->|"1. Handshake"| B["Proxy"]
    B -->|"2. Forward Handshake"| C["Backend Server"]
    B -->|"3. Bidirectional Tunnel"| C
    C -->|"Packets ↔"| B
    B -->|"Packets ↔"| A
```

### Components

1. **TCP Listener** – Listens on a configurable port (default `25565`) for incoming Minecraft client connections, using `Bun.listen`.
2. **Handshake Parser** – Reads and decodes the first packet (Handshake) sent by the client, extracting protocol version, server address, port, and next state.
3. **Backend Connection** – Establishes a TCP connection to the real Minecraft server (configurable host and port).
4. **Tunnel** – Once the handshake is forwarded, all subsequent data is piped bidirectionally between client and backend. The tunnel also handles clean shutdown and error propagation.

## Implementation Details

### VarInt Utilities (`src/varint.ts`)

VarInt is a variable-length integer encoding used extensively in the Minecraft protocol. The following functions provide synchronous reading/writing from/to a buffer.

```typescript
export function readVarIntSync(buffer: Uint8Array, offset: number): { value: number; offset: number } {
  let result = 0;
  let shift = 0;
  let byte: number;
  do {
    byte = buffer[offset]!;
    offset++;
    result |= (byte & 0x7F) << shift;
    shift += 7;
  } while ((byte & 0x80) !== 0);
  return { value: result, offset };
}

export function writeVarIntSync(buffer: Uint8Array, value: number, offset: number): number {
  do {
    let temp = value & 0x7F;
    value >>>= 7;
    if (value !== 0) {
      temp |= 0x80;
    }
    buffer[offset++] = temp;
  } while (value !== 0);
  return offset;
}

export function varIntLength(value: number): number {
  let length = 0;
  do {
    value >>>= 7;
    length++;
  } while (value !== 0);
  return length;
}
```

### Handshake Parsing (`src/handshake.ts`)

The handshake packet structure is:

- Packet length (VarInt)
- Packet ID (VarInt, must be `0x00`)
- Protocol version (VarInt)
- Server address (string: VarInt length + UTF-8 bytes)
- Server port (unsigned short, big-endian)
- Next state (VarInt)

`parseHandshake` reads a buffer and returns the decoded handshake together with the number of bytes consumed.

```typescript
export interface Handshake {
  packetLength: number;
  packetId: number;
  protocolVersion: number;
  serverAddress: string;
  serverPort: number;
  nextState: number;
}

export function parseHandshake(buffer: Uint8Array): { handshake: Handshake; bytesRead: number } {
  let offset = 0;

  const packetLengthResult = readVarIntSync(buffer, offset);
  const packetLength = packetLengthResult.value;
  offset = packetLengthResult.offset;

  const packetIdResult = readVarIntSync(buffer, offset);
  const packetId = packetIdResult.value;
  offset = packetIdResult.offset;
  if (packetId !== 0x00) {
    throw new Error(`Expected packet ID 0x00 for handshake, got ${packetId}`);
  }

  const protocolVersionResult = readVarIntSync(buffer, offset);
  const protocolVersion = protocolVersionResult.value;
  offset = protocolVersionResult.offset;

  const addressLengthResult = readVarIntSync(buffer, offset);
  const addressLength = addressLengthResult.value;
  offset = addressLengthResult.offset;

  const serverAddress = new TextDecoder().decode(buffer.slice(offset, offset + addressLength));
  offset += addressLength;

  const serverPort = (buffer[offset]! << 8) | buffer[offset + 1]!;
  offset += 2;

  const nextStateResult = readVarIntSync(buffer, offset);
  const nextState = nextStateResult.value;
  offset = nextStateResult.offset;

  // Validate we consumed exactly packetLength + length of packet length VarInt
  const expectedBytes = packetLength + varIntLength(packetLength);
  if (offset !== expectedBytes) {
    throw new Error(`Parsed ${offset} bytes but expected ${expectedBytes} for packet length ${packetLength}`);
  }

  return {
    handshake: { packetLength, packetId, protocolVersion, serverAddress, serverPort, nextState },
    bytesRead: offset,
  };
}
```



### ConnectionHandler (`src/connection-handler.ts`)

The `ConnectionHandler` class manages the lifecycle of a single client connection. It buffers data until a complete handshake is received, connects to the backend, forwards the handshake (and any leftover data), and finally creates the tunnel.

Key methods:

- `handleClientData(client, data)` – Processes incoming data. If handshake is not yet parsed, it buffers and attempts to parse. If parsed, it forwards to backend.
- `handleClientClose(client)` – Cleans up resources when client disconnects.
- `handleClientError(client, error)` – Handles client errors.

```typescript
export class ConnectionHandler {
  // ...
  handleClientData(client: Socket, data: Buffer): void {
    if (this.handshakeParsed) {
      // Forward to backend
      if (this.backendSocket?.readyState === 'open') {
        this.backendSocket.write(data);
      }
      return;
    }
    this.handleHandshake(client, data, ...);
  }
  // ...
}
```

### Proxy Server (`src/proxy.ts`)

The main entry point is `startProxy`, which creates the TCP listener. For each new connection, it instantiates a **new** `ConnectionHandler` and attaches it to the client socket's data.

```typescript
export async function startProxy(config?: Partial<ProxyConfig>) {
  const fullConfig = createConfig(config);

  const server = Bun.listen<{ handler: ConnectionHandler }>({
    hostname: '0.0.0.0',
    port: fullConfig.listenPort,
    socket: {
      open: (client) => {
        const handler = new ConnectionHandler(fullConfig);
        client.data = { handler };
      },
      data: (client, data) => {
        client.data.handler.handleClientData(client, data);
      },
      close: (client) => {
        client.data.handler.handleClientClose(client);
      },
      error: (client, error) => {
        client.data.handler.handleClientError(client, error);
      },
    },
  });

  return server;
}
```

If the file is executed directly, it starts the proxy with debug enabled:

```typescript
if (import.meta.main) {
  startProxy({ debug: true }).catch(console.error);
}
```

### Configuration (`src/config.ts`)

Configuration is defined by the `ProxyConfig` interface. Default values are provided and can be overridden via `createConfig`.

```typescript
export interface ProxyConfig {
  listenPort: number;
  backendHost: string;
  backendPort: number;
  debug: boolean;
}

export const defaultConfig: ProxyConfig = {
  listenPort: 25565,
  backendHost: 'localhost',
  backendPort: 25566,
  debug: false,
};

export function createConfig(overrides?: Partial<ProxyConfig>): ProxyConfig {
  return { ...defaultConfig, ...overrides };
}
```

## Running the Proxy

### Prerequisites

- [Bun](https://bun.sh) (version 1.3.3 or later recommended)

### Installation

```bash
bun install
```

### Start the Proxy

```bash
bun start
```

This runs the script defined in `package.json` (`bun run src/proxy.ts`) with default configuration (listen on 25565, backend localhost:25566, debug on).

To customize, you can edit the call in `src/proxy.ts` or pass configuration when calling `startProxy` programmatically.

Example: creating a custom script:

```typescript
import { startProxy } from './src/proxy.js';

startProxy({
  listenPort: 3000,
  backendHost: 'mc.example.com',
  backendPort: 25565,
  debug: true,
});
```

## Testing

The project includes a comprehensive test suite using `bun:test`.

Run all tests:

```bash
bun test
```

The tests cover:

- **VarInt** (`test/varint.test.ts`): reading, writing, length calculation.
- **Handshake parsing** (`test/handshake.test.ts`): valid and invalid packets.
- **Tunnel** (`test/tunnel.test.ts`): data forwarding, error handling, cleanup.
- **Configuration** (`test/config.test.ts`): default values and merging.

All tests should pass before deploying.

## Limitations

- **No packet inspection/modification**: The proxy only forwards bytes; it cannot alter or intercept packets.
- **No authentication**: The proxy itself does not authenticate clients; the backend server must be configured appropriately (online/offline mode).
- **Single backend**: The current implementation only supports one backend server. Load balancing or failover would require additional logic.
- **No support for proxy protocol or virtual host modification**: The handshake is forwarded as-is; advanced features like PROXY protocol or virtual host rewriting are not implemented.

## Future Enhancements

Possible improvements include:

- Support for multiple backends and load balancing.
- Integration of PROXY protocol (v1/v2).
- Optional handshake modification (e.g., rewrite virtual host).
- Connection timeouts and keep-alive.
- Metrics and logging.

## License

This project is open source under the MIT License.

---

*Documentation generated from code and inspired by the architecture description in `specs.md`.*
