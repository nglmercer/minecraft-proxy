# Minecraft TCP Proxy

A lightweight, high-performance TCP proxy and reverse tunnel library designed specifically for Minecraft, built with [Bun](https://bun.sh/).

## 📚 Documentation

-   [**Getting Started**](docs/getting-started.md): Installation and basic usage.
-   [**Architecture**](docs/architecture.md): How it works (diagrams and flow).
-   [**Configuration**](docs/configuration.md): Environment variables and options.
-   [**Executables & Deployment**](docs/executables.md): Using standalone binaries and `.env` files.
-   [**Reverse Tunneling**](docs/reverse-tunnel.md): Hosting a home server via a VPS.
-   [**API Reference**](docs/api-reference.md): For developers using the library.
-   [**Troubleshooting**](docs/troubleshooting.md): Common issues and solutions.

## Features

*   **Lightweight**: Minimal overhead using Bun's native TCP sockets.
*   **Reverse Tunneling**: Expose your home server to the world via a VPS.
*   **Handshake Validation**: Parses Minecraft protocol handshakes.
*   **Standalone Executables**: No need to install Node.js or Bun on the target machine.

## Quick Start (Standalone)

1.  Download the executable for your platform from the releases (or build it yourself).
2.  Create a `.env` file:
    ```env
    LISTEN_PORT=25565
    BACKEND_HOST=localhost
    BACKEND_PORT=25566
    ```
3.  Run the executable.

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build executables
bun run build.ts
```

## License

MIT
