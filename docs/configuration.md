# Configuration

The application can be configured via environment variables (using a `.env` file) or by passing a configuration object when using it as a library.

## Environment Variables

Create a `.env` file in the root directory or next to your executable.

### Common Options

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DEBUG` | `false` | Set to `true` to enable verbose logging. |

### Simple Proxy

| Variable | Default | Description |
| :--- | :--- | :--- |
| `LISTEN_PORT` | `25565` | Port to listen on for incoming connections. |
| `BACKEND_HOST` | `localhost` | Hostname/IP of the target Minecraft server. |
| `BACKEND_PORT` | `25566` | Port of the target Minecraft server. |

### Bridge Server (VPS)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PUBLIC_PORT` | `25565` | Port players connect to. |
| `CONTROL_PORT` | `8080` | Port the Tunnel Agent connects to. |
| `SECRET` | `default-secret` | Shared secret for authentication. **Change this!** |

### Tunnel Agent (Home)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `BRIDGE_HOST` | `localhost` | IP/Hostname of the VPS running the Bridge Server. |
| `BRIDGE_CONTROL_PORT` | `8080` | Must match `CONTROL_PORT` on the Bridge. |
| `LOCAL_HOST` | `localhost` | IP of your local Minecraft server. |
| `LOCAL_PORT` | `25565` | Port of your local Minecraft server. |
| `SECRET` | `default-secret` | Must match `SECRET` on the Bridge. |

## TypeScript Configuration Interface

When using the library programmatically, use the `ProxyConfig` interface:

```typescript
interface ProxyConfig {
  listenPort: number;
  backendHost: string;
  backendPort: number;
  debug: boolean;
}
```
