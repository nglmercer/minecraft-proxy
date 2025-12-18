# Architecture

This project implements a lightweight, modular TCP proxy for Minecraft with support for multiple transport types, protocols, and advanced authentication mechanisms.

## High-level Architecture

The project follows a layered architecture with clear separation of concerns:

```mermaid
graph TB
    A[Application Layer] --> B[Protocol Layer]
    B --> C[Transport Layer]
    C --> D[Network Layer]
    
    E[Configuration Manager] --> A
    F[Authentication System] --> A
    G[Metrics Registry] --> A
```

## Core Components

### 1. Proxy Server (`ProxyServer`)

The main entry point that orchestrates the proxy functionality:

```mermaid
graph LR
    A[Minecraft Client] -->|"1. Connect"| B[ProxyServer]
    B -->|"2. Parse Protocol"| C[Protocol Layer]
    C -->|"3. Forward"| D[Backend Server]
    B -->|"4. Tunnel"| D
    D -->|"5. Response"| B
    B -->|"6. Response"| A
```

**Features:**
- Multiple transport support (TCP/UDP)
- Pluggable protocol parsers
- Configurable handshake handling
- Connection pooling and management

### 2. Transport Layer

Abstract transport interface with concrete implementations:

```mermaid
graph TD
    A[Transport Interface] --> B[TcpTransport]
    A --> C[UdpTransport]
    A --> D[Future Transports]
    
    B --> E[TCP Connections]
    C --> F[UDP Datagrams]
```

**Responsibilities:**
- Network connection management
- Data transmission and reception
- Connection lifecycle events
- Rate limiting and security

### 3. Protocol Layer

Pluggable protocol system for different packet formats:

```mermaid
graph TD
    A[Protocol Interface] --> B[MinecraftProtocol]
    A --> C[PassthroughProtocol]
    A --> D[Custom Protocols]
    
    B --> E[Handshake Parsing]
    B --> F[VarInt Handling]
    C --> G[Raw Data Pass-through]
```

**Features:**
- Minecraft handshake parsing
- VarInt encoding/decoding
- Extensible for custom protocols
- Packet validation and error handling

### 4. Configuration Management

Advanced configuration system with multiple sources:

```mermaid
graph LR
    A[ConfigManager] --> B[Default Config]
    A --> C[File Config]
    A --> D[Environment Variables]
    A --> E[Runtime Overrides]
    
    F[Validation] --> A
    G[File Watching] --> A
```

**Capabilities:**
- YAML/JSON file support
- Environment-specific overrides
- Runtime configuration updates
- Validation and error handling

## Reverse Tunnel Architecture

Enhanced reverse tunnel with authentication and token management:

```mermaid
graph TB
    A[Player] -->|Connects to| B[BridgeServerEnhanced]
    C[TunnelAgent] -->|Authenticates with| B
    C -->|Forwards to| D[Local Minecraft Server]
    
    E[TokenManager] -->|Manages| B
    E -->|Provides tokens to| C
    
    B -.->|Secure Tunnel| C
```

### Enhanced Bridge Server Components

1. **BridgeServerEnhanced**: Main bridge with authentication
2. **TokenManager**: Handles token generation and validation
3. **Rate Limiting**: Connection and authentication rate limits
4. **Subdomain Routing**: Multi-tenant support via subdomains

### Authentication Flow

```mermaid
sequenceDiagram
    participant Agent as TunnelAgent
    participant Bridge as BridgeServerEnhanced
    participant TokenMgr as TokenManager
    
    Agent->>Bridge: CONNECT (initial)
    Bridge->>Agent: AUTH_REQUIRED
    Agent->>Bridge: AUTH <claim_code>
    Bridge->>TokenMgr: Validate Code
    TokenMgr->>Bridge: Code Valid
    Bridge->>Agent: AUTH_OK <token>
    Bridge->>TokenMgr: Generate Token
    Agent->>Bridge: AUTH <token> (subsequent)
    Bridge->>TokenMgr: Validate Token
    TokenMgr->>Bridge: Token Valid
    Bridge->>Agent: AUTH_OK
```

## Security Features

### Authentication System
- **Token-based authentication**: Secure token generation and validation
- **Claim codes**: One-time codes for initial authentication
- **Rate limiting**: Protection against brute force attacks
- **IP-based blocking**: Automatic blocking of suspicious IPs

### Connection Security
- **Timing-safe comparisons**: Protection against timing attacks
- **Connection limits**: Per-IP connection rate limiting
- **Buffer overflow protection**: Maximum buffer size limits
- **Timeout handling**: Connection timeout management

## Metrics and Monitoring

Integrated metrics system for monitoring:

```mermaid
graph LR
    A[Components] -->|Report| B[MetricsRegistry]
    B --> C[Counters]
    B --> D[Gauges]
    B --> E[Histograms]
    
    C --> F[Connection Count]
    C --> G[Auth Attempts]
    D --> H[Active Connections]
    E --> I[Response Times]
```

**Available Metrics:**
- Connection counters (total, active, failed)
- Authentication statistics
- Protocol parsing metrics
- Error rates and types

## Scalability Features

### Multi-Bridge Management
- **BridgeManager**: Manages multiple bridge instances
- **Load balancing**: Distribute connections across bridges
- **Health checking**: Monitor bridge health and status
- **Dynamic scaling**: Add/remove bridges as needed

### Namespace Support
- **Multi-tenant**: Support for multiple isolated environments
- **Subdomain routing**: Route based on subdomain patterns
- **Resource isolation**: Separate resources per namespace
- **Configuration per namespace**: Custom settings per environment
