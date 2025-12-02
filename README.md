# Minecraft TCP Proxy Library

A lightweight, high-performance TCP proxy library designed specifically for Minecraft, built with [Bun](https://bun.sh/).

## Architecture

This library implements a **TCP Proxy** (or Middleware), **NOT** a Peer-to-Peer (P2P) connection.

It sits between the Minecraft Client (player) and the Minecraft Server (backend).

```mermaid
graph LR
    A[Minecraft Client] -->|Connects to port 25565| B[TCP Proxy (This Library)]
    B -->|Forwards Handshake & Data| C[Minecraft Backend Server]
    C -->|Returns Data| B
    B -->|Returns Data| A
```

### How it works:
1.  **Listener**: The proxy listens on a specific port (e.g., 25565).
2.  **Handshake Parsing**: When a client connects, the proxy reads the initial Minecraft Handshake packet to ensure it's a valid Minecraft connection.
3.  **Backend Connection**: Once validated, the proxy establishes a connection to the actual Minecraft Backend Server.
4.  **Tunneling**: After the connection is established, the proxy creates a bidirectional tunnel, forwarding all data blindly between the Client and the Backend.

## Features

*   **Lightweight**: Minimal overhead using Bun's native TCP sockets.
*   **Handshake Validation**: Parses Minecraft protocol handshakes to verify connections.
*   **Robust Error Handling**: Handles connection drops, timeouts, and invalid packets gracefully.
*   **TypeScript Support**: Fully typed for easy integration.

## Installation

```bash
npm install minecraft-tcp-proxy
# or
bun add minecraft-tcp-proxy
```

## Usage

### Basic Example

```typescript
import { startProxy } from 'minecraft-tcp-proxy';

// Start a proxy on port 25565 that forwards to a backend on localhost:25575
const server = await startProxy({
  listenPort: 25565,
  backendHost: 'localhost',
  backendPort: 25575,
  debug: true,
});

console.log('Proxy running!');
```

### Advanced Usage

For more complex scenarios, you can run multiple proxies or integrate this library into a larger application.

See [examples/simple-proxy.ts](examples/simple-proxy.ts) for a runnable example.

### Configuration Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `listenPort` | `number` | `25565` | The port the proxy listens on. |
| `backendHost` | `string` | `'localhost'` | The hostname/IP of the backend Minecraft server. |
| `backendPort` | `number` | `25565` | The port of the backend Minecraft server. |
| `debug` | `boolean` | `false` | Enable verbose logging for debugging. |

## Documentation

For a deep dive into the internal architecture and implementation details, please refer to the [Documentation](docs/index.md).

For setting up a **Reverse Tunnel** (VPS <-> Home Server), see [Reverse Tunneling](docs/reverse-tunnel.md).

## Development

### Prerequisites
*   [Bun](https://bun.sh/) v1.0+

### Running Tests
This project includes unit tests and integration tests using real TCP sockets.

```bash
bun test
```

### Building
To build the library for distribution:

```bash
bun run build
```

## License

MIT
