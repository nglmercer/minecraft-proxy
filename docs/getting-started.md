# Getting Started

Get up and running with the Minecraft TCP Proxy in minutes. This guide covers basic setup, advanced features, and best practices.

## Prerequisites

- **Bun**: This project is built with [Bun](https://bun.sh/). You need Bun v1.0 or later installed.
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

## Quick Start

### Option 1: Install as Library

```bash
bun add minecraft-tcp-proxy
```

### Option 2: Clone and Run

```bash
git clone https://github.com/yourusername/minecraft-tcp-proxy.git
cd minecraft-tcp-proxy
bun install
```

## Basic Usage Examples

### 1. Simple TCP Proxy (2 minutes)

Create a basic proxy that forwards Minecraft traffic:

```typescript
// simple-proxy.ts
import { startProxy } from 'minecraft-tcp-proxy';

const server = await startProxy({
  proxyPort: 25566,
  minecraftHost: 'localhost',
  minecraftPort: 25565,
  debug: true,
});

console.log('🎮 Minecraft proxy running on port 25566');
console.log('📍 Forwarding to localhost:25565');
```

Run it:
```bash
bun run simple-proxy.ts
```

### 2. Advanced Proxy Server (5 minutes)

Use the new `ProxyServer` class with pluggable protocols:

```typescript
// advanced-proxy.ts
import { ProxyServer, MinecraftProtocol, TcpTransport } from 'minecraft-tcp-proxy';

const server = new ProxyServer({
  proxyPort: 25566,
  minecraftHost: 'localhost',
  minecraftPort: 25565,
  transportType: 'tcp',
  debug: true
}, new MinecraftProtocol());

await server.start();
console.log('🚀 Advanced proxy server started');
```

### 3. UDP Proxy Support (3 minutes)

Create a UDP-based proxy for special use cases:

```typescript
// udp-proxy.ts
import { startProxy } from 'minecraft-tcp-proxy';

const server = await startProxy({
  proxyPort: 25566,
  minecraftHost: 'localhost',
  minecraftPort: 25565,
  transportType: 'udp',  // UDP transport
  debug: true
});

console.log('🔊 UDP proxy server running');
```

## Reverse Tunnel Setup (10 minutes)

Host your Minecraft server behind a firewall using a public VPS.

### Step 1: Set Up Bridge Server (VPS)

```typescript
// bridge-server.ts
import { BridgeServerEnhanced } from 'minecraft-tcp-proxy';

const bridge = new BridgeServerEnhanced({
  port: 8080,
  domain: 'bridge.yourdomain.com',
  debug: true,
  
  // Enable authentication
  auth: {
    enabled: true,
    secret: 'your-secure-auth-secret',
    tokenExpiryHours: 24,
    codeExpiryMinutes: 30,
    maxTokensPerAgent: 3
  }
});

// Generate claim codes for agents
const survivalCode = bridge.generateClaimCode('survival-01', 'survival');
const creativeCode = bridge.generateClaimCode('creative-01', 'creative');

console.log('🎮 Survival claim code:', survivalCode);
console.log('🎨 Creative claim code:', creativeCode);

bridge.start();
console.log('🌉 Bridge server running on port 8080');
```

### Step 2: Set Up Tunnel Agent (Home)

```typescript
// tunnel-agent.ts
import { TunnelAgent } from 'minecraft-tcp-proxy';

const agent = new TunnelAgent({
  bridgeHost: 'your-vps-ip.com',
  bridgeControlPort: 8080,
  localHost: 'localhost',
  localPort: 25565,
  
  // Use claim code from bridge server
  claimCode: 'ABCD12', // Replace with actual code
  
  agentId: 'survival-01',
  namespace: 'survival',
  debug: true
});

agent.on('authenticated', (token) => {
  console.log('✅ Agent authenticated:', token);
});

agent.on('disconnected', () => {
  console.log('⚠️  Disconnected, reconnecting...');
});

agent.start();
console.log('🚀 Tunnel agent connecting to bridge...');
```

## Configuration Management

### Using ConfigManager

```typescript
// config-example.ts
import { ConfigManager } from 'minecraft-tcp-proxy';

const manager = new ConfigManager({
  fileName: 'minecraft-proxy.yaml',
  envFile: `config.${process.env.NODE_ENV || 'development'}.yaml`,
  defaultConfig: {
    proxyPort: 25566,
    minecraftHost: 'localhost',
    minecraftPort: 25565,
    debug: false
  },
  validator: (config) => {
    if (config.proxyPort < 1024) {
      return 'Port must be >= 1024';
    }
    return true;
  },
  onChange: (newConfig) => {
    console.log('⚙️  Configuration updated:', newConfig);
  }
});

const config = await manager.load();
console.log('📋 Configuration loaded:', config);
```

### Configuration File Example

Create `minecraft-proxy.yaml`:
```yaml
proxy:
  port: 25566
  host: 0.0.0.0
  transport: tcp
  debug: false

minecraft:
  host: localhost
  port: 25565

logging:
  level: info
  format: json

security:
  rateLimiting:
    enabled: true
    maxConnectionsPerIp: 20
    windowMs: 1000
```

## Advanced Features

### 1. Multi-Protocol Support

```typescript
// custom-protocol.ts
import { ProxyServer, Protocol, Packet } from 'minecraft-tcp-proxy';

class CustomProtocol implements Protocol {
  parse(buffer: Uint8Array): Packet | null {
    // Implement custom packet parsing
    if (buffer.length < 5) return null;
    
    return {
      size: buffer.length,
      id: buffer[0],
      data: buffer.slice(1)
    };
  }
}

const server = new ProxyServer(config, new CustomProtocol());
await server.start();
```

### 2. Custom Transport Implementation

```typescript
// custom-transport.ts
import { Transport, Connection } from 'minecraft-tcp-proxy';

class CustomTransport implements Transport {
  async listen(port: number, host?: string): Promise<void> {
    // Implement custom transport
  }
  
  onConnection(listener: (connection: Connection) => void): void {
    // Handle connections
  }
  
  close(): void {
    // Cleanup
  }
}
```

### 3. Metrics and Monitoring

```typescript
// monitoring.ts
import { globalMetrics } from 'minecraft-tcp-proxy';

// Register custom metrics
globalMetrics.registerCounter('my_custom_counter', 'Custom metric');
globalMetrics.registerGauge('my_custom_gauge', 'Custom gauge');

// Use metrics
globalMetrics.increment('my_custom_counter');
globalMetrics.set('my_custom_gauge', 42);

// Get metrics
const metrics = globalMetrics.getMetrics();
console.log('📊 Metrics:', metrics);
```

## Best Practices

### 1. Security
- Use strong authentication secrets
- Enable token-based authentication for production
- Implement firewall rules
- Monitor connection logs
- Use rate limiting

### 2. Performance
- Choose appropriate transport type (TCP vs UDP)
- Configure proper buffer sizes
- Monitor connection counts
- Use connection pooling when appropriate

### 3. Reliability
- Implement proper error handling
- Use automatic reconnection
- Monitor health metrics
- Set up alerting

## Common Use Cases

### 1. Home Server Hosting
```typescript
// Host multiple servers behind NAT
const servers = [
  { name: 'survival', port: 25565, claimCode: 'ABCD12' },
  { name: 'creative', port: 25566, claimCode: 'EFGH34' },
  { name: 'minigames', port: 25567, claimCode: 'IJKL56' }
];

servers.forEach(server => {
  const agent = new TunnelAgent({
    bridgeHost: 'vps.yourdomain.com',
    bridgePort: 8080,
    localHost: 'localhost',
    localPort: server.port,
    claimCode: server.claimCode,
    agentId: `${server.name}-01`,
    namespace: server.name
  });
  
  agent.start();
  console.log(`🎮 ${server.name} agent started`);
});
```

### 2. Load Balancing
```typescript
// Multiple proxy instances for load balancing
const instances = [
  { port: 25566, backend: 'server1.local:25565' },
  { port: 25567, backend: 'server2.local:25565' },
  { port: 25568, backend: 'server3.local:25565' }
];

instances.forEach(instance => {
  const proxy = new ProxyServer({
    proxyPort: instance.port,
    minecraftHost: instance.backend.split(':')[0],
    minecraftPort: parseInt(instance.backend.split(':')[1]),
    debug: true
  });
  
  proxy.start();
  console.log(`🔄 Load balancer on port ${instance.port}`);
});
```

### 3. Development Environment
```typescript
// Development proxy with hot reload
const config = await manager.load();

const proxy = new ProxyServer({
  ...config,
  debug: true,
  transportType: 'tcp'
});

// Watch for config changes
manager.startWatching();

proxy.start();
console.log('🔧 Development proxy started');
```

## Next Steps

- 📚 Learn about the [Architecture](architecture.md) and design principles
- 🔐 Configure [Reverse Tunneling](reverse-tunnel.md) with enhanced authentication
- 🚀 Use [Standalone Executables](executables.md) for production deployment
- ⚙️ Explore [Configuration](configuration.md) options and best practices
- 🔧 Read [Development](development.md) guide for contributing
- 🐛 Check [Troubleshooting](troubleshooting.md) for common issues

## Quick Reference

### Essential Commands
```bash
# Install dependencies
bun install

# Run basic proxy
bun run examples/simple-proxy.ts

# Run bridge server
bun run examples/bridge/basic-bridge.ts

# Run tunnel agent
bun run examples/bridge/basic-agent.ts

# Build executables
bun run build.ts

# Run tests
bun test
```

### Common Ports
- `25565` - Standard Minecraft port
- `25566` - Default proxy port
- `8080` - Default bridge control port
- `8081` - Alternative bridge port

### Default Configuration
```typescript
{
  proxyPort: 25566,
  minecraftHost: 'localhost',
  minecraftPort: 25565,
  transportType: 'tcp',
  debug: false
}
```
