# Standalone Executables & Deployment

This project provides standalone executables for Windows, Linux, and macOS, allowing you to run the proxy and tunnel components without installing Bun or Node.js.

## Available Executables

1.  **`simple-proxy`**: A standard TCP proxy that forwards traffic from one port to another.
2.  **`bridge-server`**: The server-side component for Reverse Tunneling (run this on your VPS).
3.  **`tunnel-agent`**: The client-side component for Reverse Tunneling (run this on your home server).

## Building

To build the executables for all platforms, run:

```bash
bun run build.ts
```

This will create a `dist-build` directory containing the executables (e.g., `simple-proxy-windows-x64.exe`, `bridge-server-linux-x64`, etc.).

## Configuration

All executables support configuration via a `.env` file placed in the same directory as the executable.

### 1. Simple Proxy (`simple-proxy`)

Creates a direct proxy from a local port to a backend server.

**`.env` example:**
```env
LISTEN_PORT=25565
BACKEND_HOST=localhost
BACKEND_PORT=25566
DEBUG=true
```

### 2. Bridge Server (`bridge-server`)

Run this on your public VPS. It listens for players and for the tunnel agent.

**`.env` example:**
```env
PUBLIC_PORT=25565
CONTROL_PORT=8080
SECRET=my-secure-secret
DEBUG=true
```

*   `PUBLIC_PORT`: The port players will connect to.
*   `CONTROL_PORT`: The port the `tunnel-agent` will connect to.
*   `SECRET`: A shared secret key for authentication.

### 3. Tunnel Agent (`tunnel-agent`)

Run this on your home machine where the Minecraft server is running.

**`.env` example:**
```env
BRIDGE_HOST=203.0.113.10
BRIDGE_CONTROL_PORT=8080
LOCAL_HOST=localhost
LOCAL_PORT=25565
SECRET=my-secure-secret
DEBUG=true
```

*   `BRIDGE_HOST`: The IP address or domain of your VPS (Bridge Server).
*   `BRIDGE_CONTROL_PORT`: Must match the `CONTROL_PORT` of the Bridge Server.
*   `LOCAL_HOST`: The IP of your local Minecraft server (usually `localhost`).
*   `LOCAL_PORT`: The port of your local Minecraft server.
*   `SECRET`: Must match the `SECRET` of the Bridge Server.

## Running

1.  Download or build the appropriate executable for your OS.
2.  Create a `.env` file next to the executable with your configuration.
3.  Run the executable (double-click on Windows or run from terminal).

```bash
# Linux/macOS
./bridge-server-linux-x64

# Windows
.\bridge-server-windows-x64.exe
```
