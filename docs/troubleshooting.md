# Troubleshooting

## Common Issues

### 1. `EADDRINUSE: Address already in use`

**Symptom**: The server fails to start with an error saying the address is already in use.

**Cause**: Another process is already using the configured port (e.g., `25565`). This could be a real Minecraft server or another instance of the proxy.

**Solution**:
-   Stop the other process.
-   Change the `LISTEN_PORT` (or `PUBLIC_PORT`) in your `.env` file to a different port.

### 2. Connection Refused (Proxy -> Backend)

**Symptom**: Players connect to the proxy, but get disconnected immediately. Logs show `ConnectionRefused`.

**Cause**: The proxy cannot connect to the backend Minecraft server.
-   The backend server is not running.
-   The `BACKEND_HOST` or `BACKEND_PORT` is incorrect.
-   A firewall is blocking the connection.

**Solution**:
-   Verify the Minecraft server is running and accessible.
-   Check your `.env` configuration.

### 3. Tunnel Agent fails to connect to Bridge

**Symptom**: The Tunnel Agent logs show connection errors or "Authentication failed".

**Cause**:
-   The Bridge Server is not running.
-   The `BRIDGE_HOST` is incorrect.
-   The `SECRET` in the Agent's `.env` does not match the Bridge's `.env`.

**Solution**:
-   Ensure both Agent and Bridge are running.
-   Verify the `SECRET` is identical on both sides.
-   Check firewall rules on the VPS to allow traffic on the `CONTROL_PORT`.

### 4. "Invalid Packet ID" errors

**Symptom**: Logs show errors about invalid packet IDs during the handshake.

**Cause**: The client connecting is not a Minecraft client, or is using a protocol version that sends a different initial packet structure (rare for standard Minecraft).

**Solution**:
-   Ensure only Minecraft clients are connecting to the proxy port.
-   This proxy expects a standard Minecraft Handshake packet (`0x00`) as the first message.
