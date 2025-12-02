# Getting Started

## Prerequisites

- **Bun**: This project is built with [Bun](https://bun.sh/). You need Bun v1.0 or later installed.
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

## Installation

You can install the library into your existing project:

```bash
bun add minecraft-tcp-proxy
```

Or clone the repository to run it standalone:

```bash
git clone https://github.com/yourusername/minecraft-tcp-proxy.git
cd minecraft-tcp-proxy
bun install
```

## Basic Usage

### Running as a Standalone Proxy

The easiest way to use this project is to run the built-in proxy script.

1.  **Configure**: Create a `.env` file (optional) or use environment variables.
    ```env
    PROXY_PORT=25566
    MINECRAFT_HOST=localhost
    MINECRAFT_PORT=25565
    DEBUG=true
    ```
2.  **Run**:
    ```bash
    bun start
    ```

### Using as a Library

You can import `startProxy` to use it within your own TypeScript application.

```typescript
import { startProxy } from 'minecraft-tcp-proxy';

// Start a proxy on port 25566 that forwards to a Minecraft server on localhost:25565
const server = await startProxy({
  proxyPort: 25566,
  minecraftHost: 'localhost',
  minecraftPort: 25565,
  debug: true,
});

console.log('Proxy running!');
```

## Next Steps

- Learn about the [Architecture](architecture.md).
- Configure [Reverse Tunneling](reverse-tunnel.md) for hosting behind a firewall.
- Use [Standalone Executables](executables.md) for deployment without installing Bun.
