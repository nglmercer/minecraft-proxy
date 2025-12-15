# Security Hardening & Audit Report

This database documents the security mechanisms implemented to protect the Tunnel Agent and Bridge infrastructure.

## 1. Rate Limiting (Implemented in `BridgeServer`)

To prevent Denial of Service (DoS) and Brute-force attacks, the following rate limits are enforced:

- **Authentication Protection**:

  - **Max Failures**: 5 consecutive failed attempts per IP.
  - **Lockout Duration**: 1 minute ban after reaching the limit.
  - **Mechanism**: Tracks IP states in memory with auto-cleanup.

- **Connection Flood Protection**:
  - **Rate Limit**: Max 10 new connections per second per IP.
  - **Global Limit**: Max 1000 concurrent pending player connections.
  - **Pending Timeout**: Pending player connections are dropped if the Agent does not establish the data tunnel within 10 seconds.

## 2. Resource Limits

To prevent Memory Exhaustion or "Allocation of Resources Without Limits or Throttling" (CWE-770):

- **Bridge Server**:

  - **Sniffing Buffer**: Max 4KB per connection during protocol identification.
  - **Handshake Timeout**: 5 seconds. Connections stalling in "UNKNOWN" state are dropped.

- **Tunnel Agent**:

  - **Control Socket**: Max 16KB line length to prevent memory attacks via the control channel.
  - **Local Buffering**: Max 1MB pending buffer for local data while waiting for the bridge.
  - **Concurrency**: Max 50 active tunnel connections to prevent local port/file descriptor exhaustion.

- **Proxy Server**:
  - **Handshake**: Max 4KB buffer for Minecraft handshake packets.
  - **Timeout**: 5 seconds handshake timeout.

## 3. Cryptographic Best Practices

- **Secure ID Generation**: using `crypto.randomUUID()` instead of `Math.random()` for Session IDs.
- **Timing Attack Protection**: using `crypto.timingSafeEqual()` for authentication secret comparison.

## 4. Tests

We have implemented aggressive "brute-force" style tests to validate these mechanisms.

- `test/brute-force.test.ts`: Simulates rapid authentication failures and connection floods.
- `test/security-audit.test.ts`: Simulates slowloris and memory exhaustion attacks.
