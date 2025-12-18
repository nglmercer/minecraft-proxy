# Standalone Executables & Deployment

This project provides standalone executables for Windows, Linux, and macOS, allowing you to run the proxy and tunnel components without installing Bun or Node.js.

## Available Executables

1.  **`simple-proxy`**: A standard TCP/UDP proxy that forwards traffic from one port to another.
2.  **`bridge-server`**: The enhanced server-side component for Reverse Tunneling with authentication.
3.  **`tunnel-agent`**: The enhanced client-side component for Reverse Tunneling with token support.
4.  **`proxy-server`**: Advanced proxy server with pluggable protocols and transports.

## Building

To build the executables for all platforms, run:

```bash
bun run build.ts
```

This will create a `dist-build` directory containing the executables:
- `simple-proxy-{platform}-{arch}` - Basic proxy
- `bridge-server-{platform}-{arch}` - Enhanced bridge server
- `tunnel-agent-{platform}-{arch}` - Enhanced tunnel agent
- `proxy-server-{platform}-{arch}` - Advanced proxy server

## Configuration

All executables support multiple configuration methods:
1. Environment variables (`.env` file)
2. YAML configuration files
3. Command-line arguments

### 1. Simple Proxy (`simple-proxy`)

Creates a direct proxy from a local port to a backend server with TCP/UDP support.

**`.env` example:**
```env
LISTEN_PORT=25565
BACKEND_HOST=localhost
BACKEND_PORT=25566
TRANSPORT_TYPE=tcp
DEBUG=true
```

**YAML configuration (`config.yaml`):**
```yaml
proxy:
  port: 25565
  transport: tcp
  debug: false

backend:
  host: localhost
  port: 25566
```

### 2. Bridge Server (`bridge-server`)

Enhanced bridge server with token-based authentication and multi-tenant support.

**`.env` example:**
```env
# Basic configuration
PORT=8080
DOMAIN=bridge.example.com
DEBUG=true

# Legacy authentication (optional)
SECRET=fallback-secret

# Enhanced authentication
AUTH_ENABLED=true
AUTH_SECRET=my-secure-auth-secret
TOKEN_EXPIRY_HOURS=24
CODE_EXPIRY_MINUTES=30
MAX_TOKENS_PER_AGENT=3
```

**YAML configuration (`config.yaml`):**
```yaml
bridge:
  port: 8080
  domain: bridge.example.com
  debug: true
  
  # Authentication settings
  auth:
    enabled: true
    secret: my-secure-auth-secret
    tokenExpiryHours: 24
    codeExpiryMinutes: 30
    maxTokensPerAgent: 3
  
  # Security settings
  rateLimiting:
    maxConnectionsPerIp: 20
    maxAuthAttempts: 5
    lockoutDuration: 60
```

**Advanced features:**
- **Subdomain routing**: Players connect to `{subdomain}.bridge.example.com`
- **Token authentication**: Secure token-based agent authentication
- **Claim codes**: One-time codes for agent registration
- **Multi-tenant**: Support for multiple isolated environments
- **Rate limiting**: Built-in protection against abuse

### 3. Tunnel Agent (`tunnel-agent`)

Enhanced tunnel agent with token authentication and automatic reconnection.

**`.env` example:**
```env
# Connection settings
BRIDGE_HOST=203.0.113.10
BRIDGE_CONTROL_PORT=8080
LOCAL_HOST=localhost
LOCAL_PORT=25565

# Authentication
AUTH_TOKEN=your-secure-token-here
AGENT_ID=survival-01
NAMESPACE=survival

# Optional legacy authentication
SECRET=fallback-secret

# Advanced settings
DEBUG=true
RECONNECT_INTERVAL=5000
MAX_RECONNECT_ATTEMPTS=10
```

**YAML configuration (`config.yaml`):**
```yaml
agent:
  bridgeHost: 203.0.113.10
  bridgePort: 8080
  localHost: localhost
  localPort: 25565
  
  # Authentication
  authToken: your-secure-token-here
  agentId: survival-01
  namespace: survival
  
  # Connection settings
  reconnect:
    enabled: true
    interval: 5000
    maxAttempts: 10
  
  # Logging
  debug: true
```

**Authentication methods:**
1. **Token authentication**: Use pre-generated tokens
2. **Claim code authentication**: Use one-time claim codes
3. **Legacy secret**: Fallback to shared secret

### 4. Advanced Proxy Server (`proxy-server`)

Next-generation proxy server with pluggable architecture.

**`.env` example:**
```env
# Server configuration
PROXY_PORT=25566
TRANSPORT_TYPE=tcp
PROTOCOL_TYPE=minecraft
DEBUG=true

# Backend configuration
MINECRAFT_HOST=localhost
MINECRAFT_PORT=25565

# Advanced options
MAX_CONNECTIONS=1000
HANDSHAKE_TIMEOUT=5000
BUFFER_SIZE=4096
```

**YAML configuration (`config.yaml`):**
```yaml
server:
  port: 25566
  transport: tcp
  protocol: minecraft
  debug: false

backend:
  host: localhost
  port: 25565

performance:
  maxConnections: 1000
  handshakeTimeout: 5000
  bufferSize: 4096

logging:
  level: info
  format: json
```

## Running the Executables

### Basic Usage

1. **Download** the appropriate executable for your platform
2. **Create** a configuration file (`.env` or `config.yaml`)
3. **Run** the executable

```bash
# Linux/macOS
chmod +x bridge-server-linux-x64
./bridge-server-linux-x64

# Windows
.\bridge-server-windows-x64.exe
```

### With Configuration File

```bash
# Use specific config file
./bridge-server-linux-x64 --config my-config.yaml

# Use environment file
./bridge-server-linux-x64 --env production.env

# Enable debug mode
./bridge-server-linux-x64 --debug
```

### Docker Deployment

```dockerfile
FROM ubuntu:22.04

# Copy executable
COPY bridge-server-linux-x64 /app/bridge-server
RUN chmod +x /app/bridge-server

# Copy configuration
COPY config.yaml /app/config.yaml

# Expose ports
EXPOSE 8080

# Run bridge server
CMD ["/app/bridge-server", "--config", "/app/config.yaml"]
```

## Security Best Practices

### Bridge Server
1. **Use strong authentication secrets**
2. **Enable token-based authentication**
3. **Configure rate limiting**
4. **Use firewall rules** to restrict access
5. **Monitor authentication logs**

### Tunnel Agent
1. **Store tokens securely**
2. **Use unique agent IDs**
3. **Configure proper reconnect settings**
4. **Monitor connection health**

### Network Security
1. **Use TLS/SSL** when possible
2. **Implement network segmentation**
3. **Monitor traffic patterns**
4. **Regular security audits**

## Monitoring and Logging

### Log Levels
- `error`: Critical errors only
- `warn`: Warnings and important events
- `info`: General information (default)
- `debug`: Detailed debugging information

### Metrics
The executables provide built-in metrics:
- Connection counts
- Authentication attempts
- Error rates
- Performance metrics

Access metrics via:
- Console output (with `--debug`)
- Log files
- Future HTTP endpoints (planned)

## Troubleshooting

### Common Issues

1. **Port already in use**: Check if another service is using the port
2. **Authentication failed**: Verify secrets/tokens match
3. **Connection timeout**: Check network connectivity and firewall rules
4. **Permission denied**: Ensure executable has proper permissions

### Debug Mode

Enable debug mode for detailed logging:
```bash
./bridge-server-linux-x64 --debug
# or
DEBUG=true ./bridge-server-linux-x64
```

### Configuration Validation

Most executables validate configuration on startup and provide helpful error messages. Check logs for specific configuration issues.
