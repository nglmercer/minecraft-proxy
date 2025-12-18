# Configuration

The application can be configured via environment variables (using a `.env` file), configuration files, or by passing configuration objects when using it as a library.

## Environment Variables

Create a `.env` file in the root directory or next to your executable.

### Common Options

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DEBUG` | `false` | Set to `true` to enable verbose logging. |
| `TRANSPORT_TYPE` | `tcp` | Transport type: `tcp` or `udp`. |

### Simple Proxy

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PROXY_PORT` | `25566` | Port where the proxy listens for Minecraft client connections. |
| `MINECRAFT_HOST` | `localhost` | Hostname/IP of the actual Minecraft server. |
| `MINECRAFT_PORT` | `25565` | Port of the actual Minecraft server. |

### Bridge Server (VPS)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PUBLIC_PORT` | `25565` | Port players connect to. |
| `CONTROL_PORT` | `8080` | Port the Tunnel Agent connects to. |
| `SECRET` | `default-secret` | Shared secret for authentication (legacy). |
| `DOMAIN` | `localhost` | Base domain for subdomain routing. |
| `AUTH_ENABLED` | `false` | Enable token-based authentication. |
| `AUTH_SECRET` | `auth-secret` | Secret for token authentication. |
| `TOKEN_EXPIRY_HOURS` | `24` | Token validity period in hours. |
| `CODE_EXPIRY_MINUTES` | `30` | Claim code validity period in minutes. |
| `MAX_TOKENS_PER_AGENT` | `3` | Maximum tokens per agent. |

### Tunnel Agent (Home)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `BRIDGE_HOST` | `localhost` | IP/Hostname of the VPS running the Bridge Server. |
| `BRIDGE_CONTROL_PORT` | `8080` | Must match `CONTROL_PORT` on the Bridge. |
| `LOCAL_HOST` | `localhost` | IP of your local Minecraft server. |
| `LOCAL_PORT` | `25565` | Port of your local Minecraft server. |
| `SECRET` | `default-secret` | Must match `SECRET` on the Bridge (legacy). |
| `AUTH_TOKEN` | - | Authentication token (if auth enabled). |
| `AGENT_ID` | - | Unique agent identifier. |
| `NAMESPACE` | `default` | Namespace for multi-tenant setups. |

## Configuration Files

### YAML Configuration

Create a `config.yaml` file for structured configuration:

```yaml
# Proxy configuration
proxy:
  port: 25566
  host: localhost
  transport: tcp
  debug: false

# Minecraft server
minecraft:
  host: localhost
  port: 25565

# Bridge server (if using reverse tunnel)
bridge:
  port: 8080
  domain: bridge.example.com
  auth:
    enabled: true
    secret: auth-master-secret
    tokenExpiryHours: 24
    codeExpiryMinutes: 30
    maxTokensPerAgent: 3

# Agent configuration (if using reverse tunnel)
agent:
  bridgeHost: vps.example.com
  bridgePort: 8080
  localHost: localhost
  localPort: 25565
  namespace: survival
```

### Environment-Specific Configs

Support for environment-specific configuration files:

- `config.yaml` - Base configuration
- `config.dev.yaml` - Development overrides
- `config.prod.yaml` - Production overrides

## TypeScript Configuration Interfaces

### ProxyConfig

```typescript
interface ProxyConfig {
  /** Port where the proxy listens for incoming Minecraft client connections */
  proxyPort: number;
  /** Hostname of the actual Minecraft server */
  minecraftHost: string;
  /** Port of the actual Minecraft server */
  minecraftPort: number;
  /** Transport type: tcp or udp */
  transportType: 'tcp' | 'udp';
  /** Enable debug logging */
  debug: boolean;
}
```

### BridgeConfigEnhanced

```typescript
interface BridgeConfigEnhanced {
  port: number;
  secret: string;
  debug?: boolean;
  domain?: string;
  auth?: {
    enabled: boolean;
    secret: string;
    tokenExpiryHours?: number;
    codeExpiryMinutes?: number;
    maxTokensPerAgent?: number;
  };
}
```

### AgentConfig

```typescript
interface AgentConfig {
  bridgeHost: string;
  bridgeControlPort: number;
  localHost: string;
  localPort: number;
  secret: string;
  debug?: boolean;
  authToken?: string;
  agentId?: string;
  namespace?: string;
}
```

## Configuration Manager

Advanced configuration management with the `ConfigManager` class:

```typescript
import { ConfigManager } from 'minecraft-tcp-proxy';

const manager = new ConfigManager({
  fileName: 'config.yaml',
  envFile: `config.${process.env.NODE_ENV}.yaml`,
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
    console.log('Configuration updated:', newConfig);
  }
});

// Load configuration
const config = await manager.load();

// Get specific value
const port = manager.getValue('proxyPort');

// Update configuration
await manager.update({ debug: true });

// Reset to defaults
await manager.reset();
```

### Configuration Manager Options

| Option | Type | Description |
| :--- | :--- | :--- |
| `fileName` | string | Base configuration file name |
| `envFile` | string | Environment-specific override file |
| `defaultConfig` | object | Default configuration values |
| `validator` | function | Validation function |
| `onChange` | function | Callback for configuration changes |
| `silent` | boolean | Suppress console output |

## Security Configuration

### Authentication Settings

For enhanced security with token-based authentication:

```typescript
const authConfig = {
  enabled: true,
  secret: 'your-secure-auth-secret', // Change this!
  tokenExpiryHours: 24,              // Token validity period
  codeExpiryMinutes: 30,             // Claim code validity
  maxTokensPerAgent: 3               // Limit tokens per agent
};
```

### Rate Limiting

Built-in rate limiting configuration:

- **Connection rate**: 20 connections per IP per second
- **Auth attempts**: 5 attempts before lockout
- **Lockout duration**: 60 seconds
- **Cleanup interval**: 60 seconds

## Environment Variables Priority

Configuration sources are merged in this priority order (highest to lowest):

1. Runtime configuration objects
2. Environment variables
3. Environment-specific config files
4. Base config files
5. Default configuration
