// src/core/varint.ts
function readVarIntSync(buffer, offset) {
  let result = 0;
  let shift = 0;
  let byte;
  let bytesRead = 0;
  do {
    if (offset >= buffer.length) {
      throw new Error("Buffer too short");
    }
    if (bytesRead >= 5) {
      throw new Error("VarInt too big");
    }
    byte = buffer[offset];
    offset++;
    bytesRead++;
    result |= (byte & 127) << shift;
    shift += 7;
  } while ((byte & 128) !== 0);
  return { value: result, offset };
}

// src/core/handshake.ts
function parseHandshake(buffer) {
  let offset = 0;
  const packetLengthResult = readVarIntSync(buffer, offset);
  const packetLength = packetLengthResult.value;
  offset = packetLengthResult.offset;
  const packetIdResult = readVarIntSync(buffer, offset);
  const packetId = packetIdResult.value;
  offset = packetIdResult.offset;
  if (packetId !== 0) {
    throw new Error(`Expected packet ID 0x00 for handshake, got ${packetId}`);
  }
  const protocolVersionResult = readVarIntSync(buffer, offset);
  const protocolVersion = protocolVersionResult.value;
  offset = protocolVersionResult.offset;
  const addressLengthResult = readVarIntSync(buffer, offset);
  const addressLength = addressLengthResult.value;
  offset = addressLengthResult.offset;
  if (addressLength > 1024) {
    throw new Error(`Server address too long: ${addressLength}`);
  }
  if (addressLength < 0) {
    throw new Error(`Invalid server address length: ${addressLength}`);
  }
  if (offset + addressLength > buffer.length) {
    throw new Error(`Buffer too short for address string (expected ${addressLength} bytes)`);
  }
  const serverAddress = new TextDecoder().decode(buffer.slice(offset, offset + addressLength));
  offset += addressLength;
  if (offset + 2 > buffer.length) {
    throw new Error("Buffer too short for server port");
  }
  const serverPort = buffer[offset] << 8 | buffer[offset + 1];
  offset += 2;
  const nextStateResult = readVarIntSync(buffer, offset);
  const nextState = nextStateResult.value;
  offset = nextStateResult.offset;
  if (nextState !== 1 && nextState !== 2) {
    if (nextState < 0 || nextState > 4) {
      throw new Error(`Invalid next state: ${nextState}`);
    }
  }
  const expectedBytes = packetLength + varIntLength(packetLength);
  if (offset !== expectedBytes) {
    throw new Error(`Parsed ${offset} bytes but expected ${expectedBytes} for packet length ${packetLength}`);
  }
  return {
    handshake: {
      packetLength,
      packetId,
      protocolVersion,
      serverAddress,
      serverPort,
      nextState
    },
    bytesRead: offset
  };
}
function varIntLength(value) {
  let length = 0;
  do {
    value >>>= 7;
    length++;
  } while (value !== 0);
  return length;
}
// src/transports/UdpTransport.ts
class UdpConnection {
  socket;
  remoteAddress;
  remotePort;
  sessionParams;
  data = {};
  constructor(socket, remoteAddress, remotePort, sessionParams) {
    this.socket = socket;
    this.remoteAddress = remoteAddress;
    this.remotePort = remotePort;
    this.sessionParams = sessionParams;
  }
  write(data) {
    this.socket.send(data, this.remotePort, this.remoteAddress);
  }
  close() {
    this._trigger("close");
  }
  on(event, listener) {
    if (!this.sessionParams.listeners[event]) {
      this.sessionParams.listeners[event] = [];
    }
    this.sessionParams.listeners[event].push(listener);
  }
  _trigger(event, ...args) {
    const listeners = this.sessionParams.listeners[event];
    if (listeners) {
      listeners.forEach((l) => l(...args));
    }
  }
}

class UdpTransport {
  socket = null;
  connectionHandler = null;
  sessions = new Map;
  cleanupInterval = null;
  sessionTimeoutMs = 60000;
  async listen(port, host = "0.0.0.0") {
    this.socket = await Bun.udpSocket({
      hostname: host,
      port,
      socket: {
        data: (socket, data, port2, address) => {
          const key = `${address}:${port2}`;
          let session = this.sessions.get(key);
          if (!session) {
            session = {
              address,
              port: port2,
              lastActive: Date.now(),
              listeners: {},
              connection: undefined
            };
            const conn = new UdpConnection(socket, address, port2, session);
            session.connection = conn;
            this.sessions.set(key, session);
            if (this.connectionHandler) {
              this.connectionHandler(conn);
            }
          }
          session.lastActive = Date.now();
          session.connection._trigger("data", data);
        },
        error: (socket, error) => {
          console.error("UDP Socket Error", error);
        }
      }
    });
    console.log(`UDP Transport listening on ${host}:${port}`);
    this.cleanupInterval = setInterval(() => this.cleanupSessions(), 1e4);
  }
  cleanupSessions() {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.lastActive > this.sessionTimeoutMs) {
        session.connection._trigger("close");
        this.sessions.delete(key);
      }
    }
  }
  onConnection(listener) {
    this.connectionHandler = listener;
  }
  close() {
    if (this.socket) {
      this.socket.close();
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// src/core/proxy.ts
if (false) {}
// src/reverse/agent.ts
var MAX_CONCURRENT_CONNECTIONS = 50;
var MAX_PENDING_BUFFER_SIZE = 1024 * 1024;

class TunnelAgent {
  config;
  controlSocket = null;
  reconnectTimer = null;
  activeConnections = new Set;
  constructor(config) {
    this.config = config;
  }
  start() {
    this.connectControl();
  }
  connectControl() {
    this.log(`Connecting to Bridge Control at ${this.config.bridgeHost}:${this.config.bridgeControlPort}...`);
    Bun.connect({
      hostname: this.config.bridgeHost,
      port: this.config.bridgeControlPort,
      socket: {
        open: (socket) => {
          socket.data = { buffer: "" };
          this.log("Connected to Bridge. Authenticating...");
          socket.write(`AUTH ${this.config.secret}
`);
        },
        data: (socket, data) => {
          const chunk = data.toString();
          if (!socket.data || typeof socket.data.buffer !== "string") {
            socket.data = { buffer: "" };
          }
          if (socket.data.buffer.length + chunk.length > 1024 * 16) {
            this.log("Bridge sent too much data without newline. Disconnecting.");
            socket.end();
            return;
          }
          socket.data.buffer += chunk;
          const lines = socket.data.buffer.split(`
`);
          while (lines.length > 1) {
            const msg = lines.shift().trim();
            if (!msg)
              continue;
            if (msg === "AUTH_OK") {
              this.log("Authenticated successfully. Waiting for connections...");
              this.controlSocket = socket;
              continue;
            }
            if (msg === "AUTH_FAIL") {
              this.log("Authentication failed. Check secret.");
              socket.end();
              return;
            }
            if (msg.startsWith("CONNECT ")) {
              const connId = msg.split(" ")[1];
              if (connId) {
                this.handleConnectRequest(connId);
              }
            }
          }
          socket.data.buffer = lines[0] ?? "";
        },
        close: () => {
          this.log("Bridge connection closed. Reconnecting in 5s...");
          this.controlSocket = null;
          this.scheduleReconnect();
        },
        error: (err) => {
          this.log(`Bridge connection error: ${err}`);
          this.controlSocket = null;
        }
      }
    }).catch((err) => {
      this.log(`Failed to connect to bridge: ${err}`);
      this.scheduleReconnect();
    });
  }
  scheduleReconnect() {
    if (this.reconnectTimer)
      return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectControl();
    }, 5000);
  }
  handleConnectRequest(connId) {
    if (this.activeConnections.size >= MAX_CONCURRENT_CONNECTIONS) {
      this.log(`Rejected connection ${connId}: Too many active connections (${this.activeConnections.size})`);
      return;
    }
    this.log(`Opening tunnel for connection ${connId}...`);
    this.activeConnections.add(connId);
    Bun.connect({
      hostname: this.config.localHost,
      port: this.config.localPort,
      socket: {
        open: (localSocket) => {
          localSocket.data = { buffer: [] };
          Bun.connect({
            hostname: this.config.bridgeHost,
            port: this.config.bridgeControlPort,
            socket: {
              open: (bridgeDataSocket) => {
                localSocket.data.target = bridgeDataSocket;
                const header = Buffer.from(`DATA ${connId}
`);
                bridgeDataSocket.write(header);
                if (localSocket.data.buffer.length > 0) {
                  const payload = Buffer.concat(localSocket.data.buffer);
                  this.log(`Flushing ${payload.length} bytes of buffered data to bridge`);
                  bridgeDataSocket.write(payload);
                  localSocket.data.buffer = [];
                }
                bridgeDataSocket.data = { target: localSocket };
              },
              data: (bridgeDataSocket, data) => {
                const target = bridgeDataSocket.data?.target;
                if (target)
                  target.write(data);
              },
              close: (bridgeDataSocket) => {
                const target = bridgeDataSocket.data?.target;
                if (target)
                  target.end();
              },
              error: (bridgeDataSocket) => {
                const target = bridgeDataSocket.data?.target;
                if (target)
                  target.end();
              }
            }
          }).catch((err) => {
            this.log(`Failed to connect data channel to bridge: ${err}`);
            localSocket.end();
          });
        },
        data: (localSocket, data) => {
          const state = localSocket.data;
          if (state.target) {
            state.target.write(data);
          } else {
            const currentSize = state.buffer.reduce((acc, c) => acc + c.length, 0);
            if (currentSize + data.length > MAX_PENDING_BUFFER_SIZE) {
              this.log(`Local buffer exceeded for ${connId}, dropping connection.`);
              localSocket.end();
              return;
            }
            state.buffer.push(Buffer.from(data));
          }
        },
        close: (localSocket) => {
          this.activeConnections.delete(connId);
          const state = localSocket.data;
          if (state?.target) {
            state.target.end();
          }
        },
        error: (localSocket) => {
          this.activeConnections.delete(connId);
          const state = localSocket.data;
          if (state?.target) {
            state.target.end();
          }
        }
      }
    }).catch((err) => {
      this.log(`Failed to connect to local Minecraft server: ${err}`);
      this.activeConnections.delete(connId);
    });
  }
  log(msg) {
    if (this.config.debug)
      console.log(`[Agent] ${msg}`);
  }
}
// src/reverse/bridge.ts
import { randomUUID } from "node:crypto";
import { timingSafeEqual } from "node:crypto";
var MAX_BUFFER_SIZE = 4096;
var HANDSHAKE_TIMEOUT_MS = 5000;
var MAX_AUTH_ATTEMPTS = 5;
var AUTH_LOCKOUT_MS = 60000;
var MAX_CONN_PER_IP_SEC = 10;

class BridgeServer {
  config;
  controlSocket = null;
  pendingPlayers = new Map;
  ipStates = new Map;
  constructor(config) {
    this.config = config;
  }
  start() {
    this.log(`Starting Bridge on port ${this.config.port} (MULTIPLEXED MODE)...`);
    setInterval(() => this.cleanupIpStates(), 60000);
    Bun.listen({
      hostname: "0.0.0.0",
      port: this.config.port,
      socket: {
        open: (socket) => {
          const remoteIp = socket.remoteAddress;
          if (!this.checkConnectionRateLimit(remoteIp)) {
            this.log(`Rate limit exceeded for ${remoteIp}. Dropping connection.`);
            socket.end();
            return;
          }
          const timeout = setTimeout(() => {
            this.log(`Connection timed out awaiting protocol identification: ${socket.remoteAddress}`);
            socket.end();
          }, HANDSHAKE_TIMEOUT_MS);
          socket.data = { type: "UNKNOWN", buffer: [], handshakeTimeout: timeout };
        },
        data: (socket, data) => {
          const state = socket.data;
          if (state.type === "AGENT_DATA") {
            state.target?.write(data);
            return;
          }
          if (state.type === "PLAYER") {
            if (state.target) {
              state.target.write(data);
            } else {
              state.buffer.push(Buffer.from(data));
            }
            return;
          }
          if (state.type === "AGENT_CONTROL") {
            this.handleControlMessage(socket, data);
            return;
          }
          if (state.type === "UNKNOWN") {
            const currentSize = state.buffer.reduce((acc, chunk) => acc + chunk.length, 0);
            if (currentSize + data.length > MAX_BUFFER_SIZE) {
              this.log(`Connection exceeded buffer limit during handshake: ${socket.remoteAddress}`);
              socket.end();
              return;
            }
            state.buffer.push(Buffer.from(data));
            const combined = Buffer.concat(state.buffer);
            let dataOffset = 0;
            const proxyLen = this.getProxyHeaderLength(combined);
            if (proxyLen === 0)
              return;
            if (proxyLen > 0) {
              dataOffset = proxyLen;
            }
            const effectiveBuffer = combined.subarray(dataOffset);
            if (effectiveBuffer.length < 6) {
              const partial = effectiveBuffer.toString("utf8");
              if ("DATA ".startsWith(partial) || "AUTH ".startsWith(partial) || "PROXY ".startsWith(partial)) {
                return;
              }
              const v2Sig = Buffer.from([13, 10, 13, 10, 0, 13, 10, 81, 85, 73, 84, 10]);
              if (effectiveBuffer.length > 0 && v2Sig.subarray(0, effectiveBuffer.length).equals(effectiveBuffer)) {
                return;
              }
              this.convertToPlayer(socket, effectiveBuffer);
              return;
            }
            const prefix = effectiveBuffer.subarray(0, 5).toString("utf8");
            if (prefix === "DATA " || prefix === "AUTH ") {
              const newlineIndex = effectiveBuffer.indexOf(10);
              if (newlineIndex === -1) {
                return;
              }
              const commandLine = effectiveBuffer.subarray(0, newlineIndex).toString("utf8").trim();
              const payload = effectiveBuffer.subarray(newlineIndex + 1).slice();
              state.buffer = [];
              this.clearHandshakeTimeout(socket);
              if (commandLine.startsWith("AUTH ")) {
                state.type = "AGENT_CONTROL";
                this.processAuth(socket, commandLine);
              } else if (commandLine.startsWith("DATA ")) {
                this.processDataHandshake(socket, commandLine, payload);
              }
            } else {
              this.convertToPlayer(socket, effectiveBuffer);
            }
          }
        },
        close: (socket) => {
          this.clearHandshakeTimeout(socket);
          const state = socket.data;
          if (state.type === "AGENT_CONTROL") {
            this.log("Agent Control disconnected");
            this.controlSocket = null;
          }
          if (state.connId && this.pendingPlayers.has(state.connId)) {
            this.log(`Player ${state.connId} disconnected before tunnel established`);
            this.pendingPlayers.delete(state.connId);
          }
          if (state.target) {
            state.target.end();
          }
        },
        error: (socket) => {
          this.clearHandshakeTimeout(socket);
          socket.end();
        }
      }
    });
  }
  checkConnectionRateLimit(ip) {
    const now = Date.now();
    let state = this.ipStates.get(ip);
    if (!state) {
      state = { authFailures: 0, lockoutUntil: 0, connectionsThisSecond: 0, lastConnectionTime: now };
      this.ipStates.set(ip, state);
    }
    if (state.lockoutUntil > now) {
      return false;
    }
    if (now - state.lastConnectionTime < 1000) {
      state.connectionsThisSecond++;
    } else {
      state.connectionsThisSecond = 1;
      state.lastConnectionTime = now;
    }
    if (state.connectionsThisSecond > MAX_CONN_PER_IP_SEC) {
      return false;
    }
    return true;
  }
  cleanupIpStates() {
    const now = Date.now();
    for (const [ip, state] of this.ipStates.entries()) {
      if (state.lockoutUntil < now && now - state.lastConnectionTime > 60000) {
        this.ipStates.delete(ip);
      }
    }
  }
  clearHandshakeTimeout(socket) {
    if (socket.data && socket.data.handshakeTimeout) {
      clearTimeout(socket.data.handshakeTimeout);
      socket.data.handshakeTimeout = undefined;
    }
  }
  convertToPlayer(socket, initialData) {
    this.clearHandshakeTimeout(socket);
    this.log(`Detected: MINECRAFT PLAYER (${socket.remoteAddress})`);
    if (this.pendingPlayers.size > 1000) {
      this.log("Too many pending players. Dropping.");
      socket.end();
      return;
    }
    socket.data.type = "PLAYER";
    socket.data.buffer = [initialData];
    if (!this.controlSocket) {
      this.log("No agent connected. Dropping player.");
      socket.end();
      return;
    }
    const connId = randomUUID();
    socket.data.connId = connId;
    socket.data.pendingTimeout = setTimeout(() => {
      if (this.pendingPlayers.has(connId)) {
        this.log(`Pending connection ${connId} timed out waiting for agent.`);
        this.pendingPlayers.delete(connId);
        socket.end();
      }
    }, 1e4);
    this.pendingPlayers.set(connId, socket);
    this.controlSocket.write(`CONNECT ${connId}
`);
  }
  processAuth(socket, commandLine) {
    const remoteIp = socket.remoteAddress;
    const state = this.ipStates.get(remoteIp);
    if (state.lockoutUntil > Date.now()) {
      socket.write(`AUTH_FAIL_LOCKED
`);
      socket.end();
      return;
    }
    const parts = commandLine.split(" ");
    if (parts.length < 2) {
      socket.write(`AUTH_FAIL
`);
      socket.end();
      return;
    }
    const providedSecret = parts[1] || "";
    const secretBuf = Buffer.from(this.config.secret);
    const providedBuf = Buffer.from(providedSecret);
    let valid = false;
    try {
      if (secretBuf.length === providedBuf.length) {
        valid = timingSafeEqual(secretBuf, providedBuf);
      }
    } catch (e) {
      valid = false;
    }
    if (valid) {
      state.authFailures = 0;
      socket.data.authenticated = true;
      this.controlSocket = socket;
      this.log("Agent authenticated successfully");
      socket.write(`AUTH_OK
`);
    } else {
      state.authFailures++;
      if (state.authFailures >= MAX_AUTH_ATTEMPTS) {
        this.log(`Blocking IP ${remoteIp} due to multiple auth failures`);
        state.lockoutUntil = Date.now() + AUTH_LOCKOUT_MS;
      }
      socket.write(`AUTH_FAIL
`);
      socket.end();
    }
  }
  processDataHandshake(socket, commandLine, payload) {
    const connId = commandLine.split(" ")[1];
    this.log(`Detected: AGENT DATA channel for ${connId}`);
    socket.data.type = "AGENT_DATA";
    if (connId && this.pendingPlayers.has(connId)) {
      const playerSocket = this.pendingPlayers.get(connId);
      this.pendingPlayers.delete(connId);
      if (playerSocket.data.pendingTimeout) {
        clearTimeout(playerSocket.data.pendingTimeout);
        playerSocket.data.pendingTimeout = undefined;
      }
      socket.data.target = playerSocket;
      playerSocket.data.target = socket;
      playerSocket.data.type = "PLAYER";
      if (payload.length > 0) {
        this.log(`Forwarding ${payload.length} bytes of coalesced data to player`);
        playerSocket.write(payload);
      }
      const playerBuffer = playerSocket.data.buffer;
      if (playerBuffer.length > 0) {
        this.log(`Flushing ${playerBuffer.length} buffered packets for ${connId}`);
        for (const chunk of playerBuffer) {
          socket.write(chunk);
        }
        playerSocket.data.buffer = [];
      }
      this.log(`Tunnel established for ${connId}`);
    } else {
      this.log(`Invalid connId or player gone: ${connId}`);
      socket.end();
    }
  }
  handleControlMessage(socket, data) {}
  log(msg) {
    if (this.config.debug)
      console.log(`[Bridge] ${msg}`);
  }
  getProxyHeaderLength(buffer) {
    if (buffer.length >= 6 && buffer.subarray(0, 6).toString("utf8") === "PROXY ") {
      const newline = buffer.indexOf(10);
      if (newline !== -1)
        return newline + 1;
      return 0;
    }
    const v2Sig = Buffer.from([13, 10, 13, 10, 0, 13, 10, 81, 85, 73, 84, 10]);
    if (buffer.length >= 12 && buffer.subarray(0, 12).equals(v2Sig)) {
      if (buffer.length < 16)
        return 0;
      const len = buffer.readUInt16BE(14);
      if (buffer.length < 16 + len)
        return 0;
      return 16 + len;
    }
    return -1;
  }
}
// src/lib/bridge/BridgeServer.ts
import { randomUUID as randomUUID2, timingSafeEqual as timingSafeEqual2 } from "node:crypto";

// src/lib/metrics/MetricsRegistry.ts
class MetricsRegistry {
  metrics = new Map;
  registerCounter(name, help, labels = []) {
    this.metrics.set(name, { type: "counter", help, labels, value: 0, values: new Map });
  }
  registerGauge(name, help, labels = []) {
    this.metrics.set(name, { type: "gauge", help, labels, value: 0, values: new Map });
  }
  registerHistogram(name, help, labels = [], buckets = [0.1, 0.5, 1, 5, 10]) {
    this.metrics.set(name, { type: "histogram", help, labels, buckets, values: new Map });
  }
  increment(name, labels = {}, value = 1) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== "counter")
      return;
    const key = this.getLabelKey(labels);
    const current = metric.values.get(key) || 0;
    metric.values.set(key, current + value);
  }
  set(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== "gauge")
      return;
    const key = this.getLabelKey(labels);
    metric.values.set(key, value);
  }
  observe(name, value, labels = {}) {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== "histogram")
      return;
  }
  getMetrics() {
    return Object.fromEntries(this.metrics);
  }
  getLabelKey(labels) {
    return Object.entries(labels).sort().map(([k, v]) => `${k}=${v}`).join(",");
  }
}
var globalMetrics = new MetricsRegistry;

// src/lib/bridge/BridgeServer.ts
var MAX_BUFFER_SIZE2 = 4096;
var HANDSHAKE_TIMEOUT_MS2 = 5000;
var MAX_AUTH_ATTEMPTS2 = 5;
var AUTH_LOCKOUT_MS2 = 60000;
var MAX_CONN_PER_IP_SEC2 = 20;

class BridgeServer2 {
  config;
  agents = new Map;
  pendingPlayers = new Map;
  ipStates = new Map;
  constructor(config) {
    this.config = config;
    this.initMetrics();
  }
  initMetrics() {
    globalMetrics.registerCounter("bridge_connections_total", "Total connections accepted");
    globalMetrics.registerCounter("bridge_agents_connected", "Current connected agents");
    globalMetrics.registerCounter("bridge_players_connected", "Current connected players");
  }
  start() {
    this.log(`Starting Bridge on port ${this.config.port} (MULTI-TENANT MODE)...`);
    setInterval(() => this.cleanupIpStates(), 60000);
    Bun.listen({
      hostname: "0.0.0.0",
      port: this.config.port,
      socket: {
        open: (socket) => {
          globalMetrics.increment("bridge_connections_total");
          const remoteIp = socket.remoteAddress;
          if (!this.checkConnectionRateLimit(remoteIp)) {
            this.log(`Rate limit exceeded for ${remoteIp}. Dropping connection.`);
            socket.end();
            return;
          }
          const timeout = setTimeout(() => {
            this.log(`Connection timed out awaiting protocol identification: ${socket.remoteAddress}`);
            socket.end();
          }, HANDSHAKE_TIMEOUT_MS2);
          socket.data = { type: "UNKNOWN", buffer: [], handshakeTimeout: timeout };
        },
        data: (socket, data) => {
          const state = socket.data;
          if (state.type === "AGENT_DATA") {
            state.target?.write(data);
            return;
          }
          if (state.type === "PLAYER") {
            if (state.target) {
              state.target.write(data);
            } else {
              state.buffer.push(Buffer.from(data));
            }
            return;
          }
          if (state.type === "AGENT_CONTROL") {
            this.handleControlMessage(socket, data);
            return;
          }
          if (state.type === "UNKNOWN") {
            const currentSize = state.buffer.reduce((acc, chunk) => acc + chunk.length, 0);
            if (currentSize + data.length > MAX_BUFFER_SIZE2) {
              this.log(`Connection exceeded buffer limit during handshake: ${socket.remoteAddress}`);
              socket.end();
              return;
            }
            state.buffer.push(Buffer.from(data));
            const combined = Buffer.concat(state.buffer);
            let dataOffset = 0;
            const proxyLen = this.getProxyHeaderLength(combined);
            if (proxyLen === 0)
              return;
            if (proxyLen > 0) {
              dataOffset = proxyLen;
            }
            const effectiveBuffer = combined.subarray(dataOffset);
            if (effectiveBuffer.length < 6) {
              const partial = effectiveBuffer.toString("utf8");
              if ("DATA ".startsWith(partial) || "AUTH ".startsWith(partial)) {
                return;
              }
              const v2Sig = Buffer.from([13, 10, 13, 10, 0, 13, 10, 81, 85, 73, 84, 10]);
              if (effectiveBuffer.length > 0 && v2Sig.subarray(0, effectiveBuffer.length).equals(effectiveBuffer)) {
                return;
              }
              if (effectiveBuffer.length > 2) {
                this.convertToPlayer(socket, effectiveBuffer);
                return;
              }
              return;
            }
            const prefix = effectiveBuffer.subarray(0, 5).toString("utf8");
            if (prefix === "DATA " || prefix === "AUTH ") {
              const newlineIndex = effectiveBuffer.indexOf(10);
              if (newlineIndex === -1) {
                return;
              }
              const commandLine = effectiveBuffer.subarray(0, newlineIndex).toString("utf8").trim();
              const payload = effectiveBuffer.subarray(newlineIndex + 1).slice();
              state.buffer = [];
              this.clearHandshakeTimeout(socket);
              if (commandLine.startsWith("AUTH ")) {
                state.type = "AGENT_CONTROL";
                this.processAuth(socket, commandLine);
              } else if (commandLine.startsWith("DATA ")) {
                this.processDataHandshake(socket, commandLine, payload);
              }
            } else {
              this.convertToPlayer(socket, effectiveBuffer);
            }
          }
        },
        close: (socket) => {
          this.clearHandshakeTimeout(socket);
          const state = socket.data;
          if (state.type === "AGENT_CONTROL") {
            if (state.agentId) {
              this.log(`Agent ${state.agentId} disconnected`);
              this.agents.delete(state.agentId);
              globalMetrics.increment("bridge_agents_connected", { agent: state.agentId }, -1);
            }
          }
          if (state.connId && this.pendingPlayers.has(state.connId)) {
            this.log(`Player ${state.connId} disconnected before tunnel established`);
            this.pendingPlayers.delete(state.connId);
          }
          if (state.target) {
            state.target.end();
          }
          if (state.type === "PLAYER") {
            globalMetrics.increment("bridge_players_connected", {}, -1);
          }
        },
        error: (socket) => {
          this.clearHandshakeTimeout(socket);
          socket.end();
        }
      }
    });
  }
  checkConnectionRateLimit(ip) {
    const now = Date.now();
    let state = this.ipStates.get(ip);
    if (!state) {
      state = { authFailures: 0, lockoutUntil: 0, connectionsThisSecond: 0, lastConnectionTime: now };
      this.ipStates.set(ip, state);
    }
    if (state.lockoutUntil > now) {
      return false;
    }
    if (now - state.lastConnectionTime < 1000) {
      state.connectionsThisSecond++;
    } else {
      state.connectionsThisSecond = 1;
      state.lastConnectionTime = now;
    }
    if (state.connectionsThisSecond > MAX_CONN_PER_IP_SEC2) {
      return false;
    }
    return true;
  }
  cleanupIpStates() {
    const now = Date.now();
    for (const [ip, state] of this.ipStates.entries()) {
      if (state.lockoutUntil < now && now - state.lastConnectionTime > 60000) {
        this.ipStates.delete(ip);
      }
    }
  }
  clearHandshakeTimeout(socket) {
    if (socket.data && socket.data.handshakeTimeout) {
      clearTimeout(socket.data.handshakeTimeout);
      socket.data.handshakeTimeout = undefined;
    }
  }
  convertToPlayer(socket, initialData) {
    this.clearHandshakeTimeout(socket);
    let targetAgentId = null;
    try {
      const { handshake } = parseHandshake(initialData);
      const host = handshake.serverAddress;
      if (this.config.domain) {
        const parts = host.split(".");
        if (host.endsWith(this.config.domain)) {
          const prefix = host.slice(0, -(this.config.domain.length + 1));
          if (prefix && !prefix.includes(".")) {
            targetAgentId = prefix;
          }
        }
      } else {
        targetAgentId = host.split(".")[0] || null;
      }
    } catch (e) {
      this.log(`Failed to parse handshake from ${socket.remoteAddress}: ${e}`);
    }
    if (!targetAgentId) {
      this.log(`Could not determine target agent for ${socket.remoteAddress}. Host sniffing failed.`);
      if (this.agents.has("default")) {
        targetAgentId = "default";
      } else {
        socket.end();
        return;
      }
    }
    const agentSocket = this.agents.get(targetAgentId);
    if (!agentSocket) {
      this.log(`Agent '${targetAgentId}' not connected. Dropping player.`);
      socket.end();
      return;
    }
    this.log(`Detected: MINECRAFT PLAYER (${socket.remoteAddress}) -> Route to Agent: ${targetAgentId}`);
    if (this.pendingPlayers.size > 1000) {
      this.log("Too many pending players. Dropping.");
      socket.end();
      return;
    }
    socket.data.type = "PLAYER";
    socket.data.buffer = [initialData];
    globalMetrics.increment("bridge_players_connected");
    const connId = randomUUID2();
    socket.data.connId = connId;
    socket.data.pendingTimeout = setTimeout(() => {
      if (this.pendingPlayers.has(connId)) {
        this.log(`Pending connection ${connId} timed out waiting for agent.`);
        this.pendingPlayers.delete(connId);
        socket.end();
      }
    }, 1e4);
    this.pendingPlayers.set(connId, socket);
    agentSocket.write(`CONNECT ${connId}
`);
  }
  processAuth(socket, commandLine) {
    const remoteIp = socket.remoteAddress;
    const state = this.ipStates.get(remoteIp);
    if (state.lockoutUntil > Date.now()) {
      socket.write(`AUTH_FAIL_LOCKED
`);
      socket.end();
      return;
    }
    const parts = commandLine.split(" ");
    if (parts.length < 2) {
      socket.write(`AUTH_FAIL
`);
      socket.end();
      return;
    }
    const providedSecret = parts[1] || "";
    const requestedSubdomain = parts[2] || randomUUID2().substring(0, 8);
    const secretBuf = Buffer.from(this.config.secret);
    const providedBuf = Buffer.from(providedSecret);
    let valid = false;
    try {
      if (secretBuf.length === providedBuf.length) {
        valid = timingSafeEqual2(secretBuf, providedBuf);
      }
    } catch (e) {
      valid = false;
    }
    if (valid) {
      if (this.agents.has(requestedSubdomain)) {
        this.log(`Agent attempted to claim already active subdomain '${requestedSubdomain}'. Rejecting.`);
        socket.write(`AUTH_FAIL_IN_USE
`);
        socket.end();
        return;
      }
      state.authFailures = 0;
      socket.data.authenticated = true;
      socket.data.agentId = requestedSubdomain;
      this.agents.set(requestedSubdomain, socket);
      this.log(`Agent authenticated successfully as '${requestedSubdomain}'`);
      globalMetrics.increment("bridge_agents_connected");
      socket.write(`AUTH_OK ${requestedSubdomain}.bridge
`);
    } else {
      state.authFailures++;
      if (state.authFailures >= MAX_AUTH_ATTEMPTS2) {
        this.log(`Blocking IP ${remoteIp} due to multiple auth failures`);
        state.lockoutUntil = Date.now() + AUTH_LOCKOUT_MS2;
      }
      socket.write(`AUTH_FAIL
`);
      socket.end();
    }
  }
  processDataHandshake(socket, commandLine, payload) {
    const connId = commandLine.split(" ")[1];
    if (!connId) {
      socket.end();
      return;
    }
    this.log(`Detected: AGENT DATA channel for ${connId}`);
    socket.data.type = "AGENT_DATA";
    if (this.pendingPlayers.has(connId)) {
      const playerSocket = this.pendingPlayers.get(connId);
      this.pendingPlayers.delete(connId);
      if (playerSocket.data.pendingTimeout) {
        clearTimeout(playerSocket.data.pendingTimeout);
        playerSocket.data.pendingTimeout = undefined;
      }
      socket.data.target = playerSocket;
      playerSocket.data.target = socket;
      playerSocket.data.type = "PLAYER";
      if (payload.length > 0) {
        this.log(`Forwarding ${payload.length} bytes of coalesced data to player`);
        playerSocket.write(payload);
      }
      const playerBuffer = playerSocket.data.buffer;
      if (playerBuffer.length > 0) {
        this.log(`Flushing ${playerBuffer.length} buffered packets for ${connId}`);
        for (const chunk of playerBuffer) {
          socket.write(chunk);
        }
        playerSocket.data.buffer = [];
      }
      this.log(`Tunnel established for ${connId}`);
    } else {
      this.log(`Invalid connId or player gone: ${connId}`);
      socket.end();
    }
  }
  handleControlMessage(socket, data) {}
  log(msg) {
    if (this.config.debug)
      console.log(`[Bridge] ${msg}`);
  }
  getProxyHeaderLength(buffer) {
    if (buffer.length >= 6 && buffer.subarray(0, 6).toString("utf8") === "PROXY ") {
      const newline = buffer.indexOf(10);
      if (newline !== -1)
        return newline + 1;
      return 0;
    }
    const v2Sig = Buffer.from([13, 10, 13, 10, 0, 13, 10, 81, 85, 73, 84, 10]);
    if (buffer.length >= 12 && buffer.subarray(0, 12).equals(v2Sig)) {
      if (buffer.length < 16)
        return 0;
      const len = buffer.readUInt16BE(14);
      if (buffer.length < 16 + len)
        return 0;
      return 16 + len;
    }
    return -1;
  }
}
// src/lib/bridge/BridgeServerEnhanced.ts
import { randomUUID as randomUUID4, timingSafeEqual as timingSafeEqual4 } from "node:crypto";

// src/lib/auth/TokenManager.ts
import { randomUUID as randomUUID3, randomBytes } from "node:crypto";
import { timingSafeEqual as timingSafeEqual3 } from "node:crypto";

class TokenManager {
  tokens = new Map;
  claimCodes = new Map;
  config;
  constructor(config) {
    this.config = {
      tokenExpiryHours: 24,
      codeExpiryMinutes: 30,
      maxTokensPerAgent: 5,
      ...config
    };
  }
  generateClaimCode(agentId, namespace) {
    this.cleanupExpiredCodes();
    const code = this.generateSecureCode();
    const claimCode = {
      code,
      agentId,
      namespace,
      createdAt: new Date,
      expiresAt: new Date(Date.now() + this.config.codeExpiryMinutes * 60 * 1000),
      isUsed: false
    };
    this.claimCodes.set(code, claimCode);
    return code;
  }
  redeemClaimCode(code) {
    const claimCode = this.claimCodes.get(code);
    if (!claimCode || claimCode.isUsed || claimCode.expiresAt < new Date) {
      return null;
    }
    claimCode.isUsed = true;
    const token = this.generateToken(claimCode.agentId, claimCode.namespace);
    return token;
  }
  generateToken(agentId, namespace) {
    this.cleanupExpiredTokens();
    const agentTokens = Array.from(this.tokens.values()).filter((t) => t.agentId === agentId && t.isActive);
    if (agentTokens.length >= this.config.maxTokensPerAgent) {
      const oldestToken = agentTokens.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      if (oldestToken) {
        this.tokens.delete(oldestToken.token);
      }
    }
    const token = {
      token: this.generateSecureToken(),
      agentId,
      namespace,
      createdAt: new Date,
      expiresAt: new Date(Date.now() + this.config.tokenExpiryHours * 60 * 60 * 1000),
      isActive: true
    };
    this.tokens.set(token.token, token);
    return token;
  }
  validateToken(token) {
    const agentToken = this.tokens.get(token);
    if (!agentToken || !agentToken.isActive || agentToken.expiresAt < new Date) {
      return null;
    }
    return agentToken;
  }
  revokeToken(token) {
    const agentToken = this.tokens.get(token);
    if (agentToken) {
      agentToken.isActive = false;
      return true;
    }
    return false;
  }
  revokeAllTokens(agentId) {
    let revoked = 0;
    for (const token of this.tokens.values()) {
      if (token.agentId === agentId && token.isActive) {
        token.isActive = false;
        revoked++;
      }
    }
    return revoked;
  }
  getAgentTokens(agentId) {
    return Array.from(this.tokens.values()).filter((t) => t.agentId === agentId && t.isActive && t.expiresAt > new Date);
  }
  getStats() {
    const now = new Date;
    const activeTokens = Array.from(this.tokens.values()).filter((t) => t.isActive && t.expiresAt > now);
    const activeCodes = Array.from(this.claimCodes.values()).filter((c) => !c.isUsed && c.expiresAt > now);
    return {
      totalTokens: this.tokens.size,
      activeTokens: activeTokens.length,
      totalCodes: this.claimCodes.size,
      activeCodes: activeCodes.length,
      tokensByAgent: activeTokens.reduce((acc, token) => {
        acc[token.agentId] = (acc[token.agentId] || 0) + 1;
        return acc;
      }, {})
    };
  }
  generateSecureCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    const randomValues = randomBytes(6);
    for (let i = 0;i < 6; i++) {
      const byte = randomValues[i];
      if (byte !== undefined) {
        const charIndex = byte % chars.length;
        code += chars[charIndex];
      }
    }
    return code;
  }
  generateSecureToken() {
    return randomUUID3() + randomUUID3();
  }
  cleanupExpiredTokens() {
    const now = new Date;
    for (const [token, agentToken] of this.tokens.entries()) {
      if (agentToken.expiresAt < now || !agentToken.isActive) {
        this.tokens.delete(token);
      }
    }
  }
  cleanupExpiredCodes() {
    const now = new Date;
    for (const [code, claimCode] of this.claimCodes.entries()) {
      if (claimCode.expiresAt < now || claimCode.isUsed) {
        this.claimCodes.delete(code);
      }
    }
  }
  static secureCompare(a, b) {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    if (bufferA.length !== bufferB.length) {
      return false;
    }
    return timingSafeEqual3(bufferA, bufferB);
  }
}

// src/lib/bridge/BridgeServerEnhanced.ts
var MAX_BUFFER_SIZE3 = 4096;
var HANDSHAKE_TIMEOUT_MS3 = 5000;
var MAX_AUTH_ATTEMPTS3 = 5;
var AUTH_LOCKOUT_MS3 = 60000;
var MAX_CONN_PER_IP_SEC3 = 20;

class BridgeServerEnhanced {
  config;
  agents = new Map;
  pendingPlayers = new Map;
  ipStates = new Map;
  tokenManager = null;
  constructor(config) {
    this.config = config;
    this.initMetrics();
    if (config.auth?.enabled) {
      this.tokenManager = new TokenManager({
        secret: config.auth.secret,
        tokenExpiryHours: config.auth.tokenExpiryHours,
        codeExpiryMinutes: config.auth.codeExpiryMinutes,
        maxTokensPerAgent: config.auth.maxTokensPerAgent
      });
    }
  }
  initMetrics() {
    globalMetrics.registerCounter("bridge_connections_total", "Total connections accepted");
    globalMetrics.registerCounter("bridge_agents_connected", "Current connected agents");
    globalMetrics.registerCounter("bridge_players_connected", "Current connected players");
  }
  start() {
    const authStatus = this.tokenManager ? "AUTH-ENABLED" : "AUTH-DISABLED";
    this.log(`Starting Enhanced Bridge on port ${this.config.port} (${authStatus})...`);
    setInterval(() => this.cleanupIpStates(), 60000);
    Bun.listen({
      hostname: "0.0.0.0",
      port: this.config.port,
      socket: {
        open: (socket) => {
          globalMetrics.increment("bridge_connections_total");
          const remoteIp = socket.remoteAddress;
          if (!this.checkConnectionRateLimit(remoteIp)) {
            this.log(`Rate limit exceeded for ${remoteIp}. Dropping connection.`);
            socket.end();
            return;
          }
          const timeout = setTimeout(() => {
            this.log(`Connection timed out awaiting protocol identification: ${socket.remoteAddress}`);
            socket.end();
          }, HANDSHAKE_TIMEOUT_MS3);
          socket.data = { type: "UNKNOWN", buffer: [], handshakeTimeout: timeout };
        },
        data: (socket, data) => {
          const state = socket.data;
          if (state.type === "AGENT_DATA") {
            state.target?.write(data);
            return;
          }
          if (state.type === "PLAYER") {
            if (state.target) {
              state.target.write(data);
            } else {
              state.buffer.push(Buffer.from(data));
            }
            return;
          }
          if (state.type === "AGENT_CONTROL") {
            this.handleControlMessage(socket, data);
            return;
          }
          if (state.type === "UNKNOWN") {
            const currentSize = state.buffer.reduce((acc, chunk) => acc + chunk.length, 0);
            if (currentSize + data.length > MAX_BUFFER_SIZE3) {
              this.log(`Connection exceeded buffer limit during handshake: ${socket.remoteAddress}`);
              socket.end();
              return;
            }
            state.buffer.push(Buffer.from(data));
            const combined = Buffer.concat(state.buffer);
            let dataOffset = 0;
            const proxyLen = this.getProxyHeaderLength(combined);
            if (proxyLen === 0)
              return;
            if (proxyLen > 0) {
              dataOffset = proxyLen;
            }
            const effectiveBuffer = combined.subarray(dataOffset);
            if (effectiveBuffer.length < 6) {
              const partial = effectiveBuffer.toString("utf8");
              if ("DATA ".startsWith(partial) || "AUTH ".startsWith(partial)) {
                return;
              }
              const v2Sig = Buffer.from([13, 10, 13, 10, 0, 13, 10, 81, 85, 73, 84, 10]);
              if (effectiveBuffer.length > 0 && v2Sig.subarray(0, effectiveBuffer.length).equals(effectiveBuffer)) {
                return;
              }
              if (effectiveBuffer.length > 2) {
                this.convertToPlayer(socket, effectiveBuffer);
                return;
              }
              return;
            }
            const prefix = effectiveBuffer.subarray(0, 5).toString("utf8");
            if (prefix === "DATA " || prefix === "AUTH ") {
              const newlineIndex = effectiveBuffer.indexOf(10);
              if (newlineIndex === -1) {
                return;
              }
              const commandLine = effectiveBuffer.subarray(0, newlineIndex).toString("utf8").trim();
              const payload = effectiveBuffer.subarray(newlineIndex + 1).slice();
              state.buffer = [];
              this.clearHandshakeTimeout(socket);
              if (commandLine.startsWith("AUTH ")) {
                state.type = "AGENT_CONTROL";
                this.processAuth(socket, commandLine);
              } else if (commandLine.startsWith("DATA ")) {
                this.processDataHandshake(socket, commandLine, payload);
              }
            } else {
              this.convertToPlayer(socket, effectiveBuffer);
            }
          }
        },
        close: (socket) => {
          this.clearHandshakeTimeout(socket);
          const state = socket.data;
          if (state.type === "AGENT_CONTROL") {
            if (state.agentId) {
              this.log(`Agent ${state.agentId} disconnected`);
              this.agents.delete(state.agentId);
              globalMetrics.increment("bridge_agents_connected", { agent: state.agentId }, -1);
            }
          }
          if (state.connId && this.pendingPlayers.has(state.connId)) {
            this.log(`Player ${state.connId} disconnected before tunnel established`);
            this.pendingPlayers.delete(state.connId);
          }
          if (state.target) {
            state.target.end();
          }
          if (state.type === "PLAYER") {
            globalMetrics.increment("bridge_players_connected", {}, -1);
          }
        },
        error: (socket) => {
          this.clearHandshakeTimeout(socket);
          socket.end();
        }
      }
    });
  }
  generateClaimCode(agentId, namespace) {
    if (!this.tokenManager) {
      throw new Error("Token manager not initialized - auth is disabled");
    }
    return this.tokenManager.generateClaimCode(agentId, namespace);
  }
  redeemClaimCode(code) {
    if (!this.tokenManager) {
      throw new Error("Token manager not initialized - auth is disabled");
    }
    const token = this.tokenManager.redeemClaimCode(code);
    if (token) {
      return {
        token: token.token,
        agentId: token.agentId,
        namespace: token.namespace
      };
    }
    return null;
  }
  getTokenStats() {
    if (!this.tokenManager) {
      return { enabled: false };
    }
    return {
      enabled: true,
      ...this.tokenManager.getStats()
    };
  }
  checkConnectionRateLimit(ip) {
    const now = Date.now();
    let state = this.ipStates.get(ip);
    if (!state) {
      state = { authFailures: 0, lockoutUntil: 0, connectionsThisSecond: 0, lastConnectionTime: now };
      this.ipStates.set(ip, state);
    }
    if (state.lockoutUntil > now) {
      return false;
    }
    if (now - state.lastConnectionTime < 1000) {
      state.connectionsThisSecond++;
    } else {
      state.connectionsThisSecond = 1;
      state.lastConnectionTime = now;
    }
    if (state.connectionsThisSecond > MAX_CONN_PER_IP_SEC3) {
      return false;
    }
    return true;
  }
  cleanupIpStates() {
    const now = Date.now();
    for (const [ip, state] of this.ipStates.entries()) {
      if (state.lockoutUntil < now && now - state.lastConnectionTime > 60000) {
        this.ipStates.delete(ip);
      }
    }
  }
  clearHandshakeTimeout(socket) {
    if (socket.data && socket.data.handshakeTimeout) {
      clearTimeout(socket.data.handshakeTimeout);
      socket.data.handshakeTimeout = undefined;
    }
  }
  convertToPlayer(socket, initialData) {
    this.clearHandshakeTimeout(socket);
    let targetAgentId = null;
    try {
      const { handshake } = parseHandshake(initialData);
      const host = handshake.serverAddress;
      if (this.config.domain) {
        const parts = host.split(".");
        if (host.endsWith(this.config.domain)) {
          const prefix = host.slice(0, -(this.config.domain.length + 1));
          if (prefix && !prefix.includes(".")) {
            targetAgentId = prefix;
          }
        }
      } else {
        targetAgentId = host.split(".")[0] || null;
      }
    } catch (e) {
      this.log(`Failed to parse handshake from ${socket.remoteAddress}: ${e}`);
    }
    if (!targetAgentId) {
      this.log(`Could not determine target agent for ${socket.remoteAddress}. Host sniffing failed.`);
      if (this.agents.has("default")) {
        targetAgentId = "default";
      } else {
        socket.end();
        return;
      }
    }
    const agentSocket = this.agents.get(targetAgentId);
    if (!agentSocket) {
      this.log(`Agent '${targetAgentId}' not connected. Dropping player.`);
      socket.end();
      return;
    }
    this.log(`Detected: MINECRAFT PLAYER (${socket.remoteAddress}) -> Route to Agent: ${targetAgentId}`);
    if (this.pendingPlayers.size > 1000) {
      this.log("Too many pending players. Dropping.");
      socket.end();
      return;
    }
    socket.data.type = "PLAYER";
    socket.data.buffer = [initialData];
    globalMetrics.increment("bridge_players_connected");
    const connId = randomUUID4();
    socket.data.connId = connId;
    socket.data.pendingTimeout = setTimeout(() => {
      if (this.pendingPlayers.has(connId)) {
        this.log(`Pending connection ${connId} timed out waiting for agent.`);
        this.pendingPlayers.delete(connId);
        socket.end();
      }
    }, 1e4);
    this.pendingPlayers.set(connId, socket);
    agentSocket.write(`CONNECT ${connId}
`);
  }
  processAuth(socket, commandLine) {
    const remoteIp = socket.remoteAddress;
    const state = this.ipStates.get(remoteIp);
    if (state.lockoutUntil > Date.now()) {
      socket.write(`AUTH_FAIL_LOCKED
`);
      socket.end();
      return;
    }
    const parts = commandLine.split(" ");
    if (this.tokenManager) {
      this.processAuthWithTokens(socket, commandLine, parts);
    } else {
      this.processAuthWithSecret(socket, commandLine, parts, state);
    }
  }
  processAuthWithTokens(socket, commandLine, parts) {
    if (parts.length < 2) {
      socket.write(`AUTH_FAIL_INVALID_FORMAT
`);
      socket.end();
      return;
    }
    const providedToken = parts[1] || "";
    const requestedSubdomain = parts[2];
    const token = this.tokenManager.validateToken(providedToken);
    if (token) {
      this.completeAuth(socket, token.agentId, token.namespace);
      return;
    }
    const redeemed = this.tokenManager.redeemClaimCode(providedToken);
    if (redeemed) {
      const newToken = this.tokenManager.generateToken(redeemed.agentId, redeemed.namespace);
      this.completeAuth(socket, newToken.agentId, newToken.namespace);
      socket.write(`AUTH_OK ${newToken.agentId}.${newToken.namespace} ${newToken.token}
`);
      return;
    }
    socket.write(`AUTH_FAIL_INVALID_CREDENTIALS
`);
    socket.end();
  }
  processAuthWithSecret(socket, commandLine, parts, state) {
    if (parts.length < 2) {
      socket.write(`AUTH_FAIL
`);
      socket.end();
      return;
    }
    const providedSecret = parts[1] || "";
    const requestedSubdomain = parts[2] || randomUUID4().substring(0, 8);
    const secretBuf = Buffer.from(this.config.secret);
    const providedBuf = Buffer.from(providedSecret);
    let valid = false;
    try {
      if (secretBuf.length === providedBuf.length) {
        valid = timingSafeEqual4(secretBuf, providedBuf);
      }
    } catch (e) {
      valid = false;
    }
    if (valid) {
      if (this.agents.has(requestedSubdomain)) {
        this.log(`Agent attempted to claim already active subdomain '${requestedSubdomain}'. Rejecting.`);
        socket.write(`AUTH_FAIL_IN_USE
`);
        socket.end();
        return;
      }
      state.authFailures = 0;
      socket.data.authenticated = true;
      socket.data.agentId = requestedSubdomain;
      this.agents.set(requestedSubdomain, socket);
      this.log(`Agent authenticated successfully as '${requestedSubdomain}'`);
      globalMetrics.increment("bridge_agents_connected");
      socket.write(`AUTH_OK ${requestedSubdomain}.bridge
`);
    } else {
      state.authFailures++;
      if (state.authFailures >= MAX_AUTH_ATTEMPTS3) {
        this.log(`Blocking IP ${socket.remoteAddress} due to multiple auth failures`);
        state.lockoutUntil = Date.now() + AUTH_LOCKOUT_MS3;
      }
      socket.write(`AUTH_FAIL
`);
      socket.end();
    }
  }
  completeAuth(socket, agentId, namespace) {
    if (this.agents.has(agentId)) {
      socket.write(`AUTH_FAIL_AGENT_ALREADY_CONNECTED
`);
      socket.end();
      return;
    }
    socket.data.authenticated = true;
    socket.data.agentId = agentId;
    this.agents.set(agentId, socket);
    this.log(`Agent authenticated successfully: ${agentId}.${namespace}`);
    globalMetrics.increment("bridge_agents_connected");
    socket.write(`AUTH_OK ${agentId}.${namespace}
`);
  }
  processDataHandshake(socket, commandLine, payload) {
    const connId = commandLine.split(" ")[1];
    if (!connId) {
      socket.end();
      return;
    }
    this.log(`Detected: AGENT DATA channel for ${connId}`);
    socket.data.type = "AGENT_DATA";
    if (this.pendingPlayers.has(connId)) {
      const playerSocket = this.pendingPlayers.get(connId);
      this.pendingPlayers.delete(connId);
      if (playerSocket.data.pendingTimeout) {
        clearTimeout(playerSocket.data.pendingTimeout);
        playerSocket.data.pendingTimeout = undefined;
      }
      socket.data.target = playerSocket;
      playerSocket.data.target = socket;
      playerSocket.data.type = "PLAYER";
      if (payload.length > 0) {
        this.log(`Forwarding ${payload.length} bytes of coalesced data to player`);
        playerSocket.write(payload);
      }
      const playerBuffer = playerSocket.data.buffer;
      if (playerBuffer.length > 0) {
        this.log(`Flushing ${playerBuffer.length} buffered packets for ${connId}`);
        for (const chunk of playerBuffer) {
          socket.write(chunk);
        }
        playerSocket.data.buffer = [];
      }
      this.log(`Tunnel established for ${connId}`);
    } else {
      this.log(`Invalid connId or player gone: ${connId}`);
      socket.end();
    }
  }
  handleControlMessage(socket, data) {}
  log(msg) {
    const authStatus = this.tokenManager ? "AUTH-ENABLED" : "AUTH-DISABLED";
    console.log(`[Bridge:${authStatus}] ${msg}`);
  }
  getProxyHeaderLength(buffer) {
    if (buffer.length >= 6 && buffer.subarray(0, 6).toString("utf8") === "PROXY ") {
      const newline = buffer.indexOf(10);
      if (newline !== -1)
        return newline + 1;
      return 0;
    }
    const v2Sig = Buffer.from([13, 10, 13, 10, 0, 13, 10, 81, 85, 73, 84, 10]);
    if (buffer.length >= 12 && buffer.subarray(0, 12).equals(v2Sig)) {
      if (buffer.length < 16)
        return 0;
      const len = buffer.readUInt16BE(14);
      if (buffer.length < 16 + len)
        return 0;
      return 16 + len;
    }
    return -1;
  }
}
// src/lib/bridge/TunnelAgent.ts
var MAX_CONCURRENT_CONNECTIONS2 = 50;
var MAX_PENDING_BUFFER_SIZE2 = 1024 * 1024;

class TunnelAgent2 {
  config;
  controlSocket = null;
  reconnectTimer = null;
  activeConnections = new Set;
  constructor(config) {
    this.config = config;
  }
  start() {
    this.connectControl();
  }
  connectControl() {
    this.log(`Connecting to Bridge Control at ${this.config.bridgeHost}:${this.config.bridgeControlPort}...`);
    Bun.connect({
      hostname: this.config.bridgeHost,
      port: this.config.bridgeControlPort,
      socket: {
        open: (socket) => {
          socket.data = { buffer: "" };
          this.log("Connected to Bridge. Authenticating...");
          socket.write(`AUTH ${this.config.secret}
`);
        },
        data: (socket, data) => {
          const chunk = data.toString();
          if (!socket.data || typeof socket.data.buffer !== "string") {
            socket.data = { buffer: "" };
          }
          if (socket.data.buffer.length + chunk.length > 1024 * 16) {
            this.log("Bridge sent too much data without newline. Disconnecting.");
            socket.end();
            return;
          }
          socket.data.buffer += chunk;
          const lines = socket.data.buffer.split(`
`);
          while (lines.length > 1) {
            const msg = lines.shift().trim();
            if (!msg)
              continue;
            if (msg.startsWith("AUTH_OK")) {
              const assignedDomain = msg.split(" ")[1];
              this.log(`Authenticated successfully. Domain: ${assignedDomain || "default"}`);
              this.controlSocket = socket;
              continue;
            }
            if (msg === "AUTH_FAIL") {
              this.log("Authentication failed. Check secret.");
              socket.end();
              return;
            }
            if (msg.startsWith("CONNECT ")) {
              const connId = msg.split(" ")[1];
              if (connId) {
                this.handleConnectRequest(connId);
              }
            }
          }
          socket.data.buffer = lines[0] ?? "";
        },
        close: () => {
          this.log("Bridge connection closed. Reconnecting in 5s...");
          this.controlSocket = null;
          this.scheduleReconnect();
        },
        error: (err) => {
          this.log(`Bridge connection error: ${err}`);
          this.controlSocket = null;
        }
      }
    }).catch((err) => {
      this.log(`Failed to connect to bridge: ${err}`);
      this.scheduleReconnect();
    });
  }
  scheduleReconnect() {
    if (this.reconnectTimer)
      return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectControl();
    }, 5000);
  }
  handleConnectRequest(connId) {
    if (this.activeConnections.size >= MAX_CONCURRENT_CONNECTIONS2) {
      this.log(`Rejected connection ${connId}: Too many active connections (${this.activeConnections.size})`);
      return;
    }
    this.log(`Opening tunnel for connection ${connId}...`);
    this.activeConnections.add(connId);
    Bun.connect({
      hostname: this.config.localHost,
      port: this.config.localPort,
      socket: {
        open: (localSocket) => {
          localSocket.data = { buffer: [] };
          Bun.connect({
            hostname: this.config.bridgeHost,
            port: this.config.bridgeControlPort,
            socket: {
              open: (bridgeDataSocket) => {
                localSocket.data.target = bridgeDataSocket;
                const header = Buffer.from(`DATA ${connId}
`);
                bridgeDataSocket.write(header);
                if (localSocket.data.buffer.length > 0) {
                  const payload = Buffer.concat(localSocket.data.buffer);
                  this.log(`Flushing ${payload.length} bytes of buffered data to bridge`);
                  bridgeDataSocket.write(payload);
                  localSocket.data.buffer = [];
                }
                bridgeDataSocket.data = { target: localSocket };
              },
              data: (bridgeDataSocket, data) => {
                const target = bridgeDataSocket.data?.target;
                if (target)
                  target.write(data);
              },
              close: (bridgeDataSocket) => {
                const target = bridgeDataSocket.data?.target;
                if (target)
                  target.end();
              },
              error: (bridgeDataSocket) => {
                const target = bridgeDataSocket.data?.target;
                if (target)
                  target.end();
              }
            }
          }).catch((err) => {
            this.log(`Failed to connect data channel to bridge: ${err}`);
            localSocket.end();
          });
        },
        data: (localSocket, data) => {
          const state = localSocket.data;
          if (state.target) {
            state.target.write(data);
          } else {
            const currentSize = state.buffer.reduce((acc, c) => acc + c.length, 0);
            if (currentSize + data.length > MAX_PENDING_BUFFER_SIZE2) {
              this.log(`Local buffer exceeded for ${connId}, dropping connection.`);
              localSocket.end();
              return;
            }
            state.buffer.push(Buffer.from(data));
          }
        },
        close: (localSocket) => {
          this.activeConnections.delete(connId);
          const state = localSocket.data;
          if (state?.target) {
            state.target.end();
          }
        },
        error: (localSocket) => {
          this.activeConnections.delete(connId);
          const state = localSocket.data;
          if (state?.target) {
            state.target.end();
          }
        }
      }
    }).catch((err) => {
      this.log(`Failed to connect to local Minecraft server: ${err}`);
      this.activeConnections.delete(connId);
    });
  }
  log(msg) {
    if (this.config.debug)
      console.log(`[Agent] ${msg}`);
  }
}
// src/lib/bridge/BridgeManager.ts
class BridgeManager {
  instances = new Map;
  constructor() {
    globalMetrics.registerGauge("bridge_instances_count", "Number of active bridge instances");
  }
  createInstance(config) {
    if (this.instances.has(config.port)) {
      throw new Error(`Bridge already running on port ${config.port}`);
    }
    const bridge = new BridgeServer2(config);
    bridge.start();
    this.instances.set(config.port, bridge);
    globalMetrics.set("bridge_instances_count", this.instances.size);
    return bridge;
  }
  stopInstance(port) {
    const instance = this.instances.get(port);
    if (instance) {
      this.instances.delete(port);
      globalMetrics.set("bridge_instances_count", this.instances.size);
    }
  }
  getAllInstances() {
    return Array.from(this.instances.values());
  }
}
var defaultBridgeManager = new BridgeManager;
// examples/bridge/basic-bridge.ts
var config2 = {
  port: 8080,
  secret: "my-super-secret-key",
  debug: true,
  domain: "bridge.example.com",
  auth: {
    enabled: false,
    secret: "auth-secret-key"
  }
};
console.log("\uD83D\uDE80 Iniciando Bridge Server Básico...");
console.log("\uD83D\uDCCD Puerto:", config2.port);
console.log("\uD83D\uDD11 Secreto compartido:", config2.secret);
console.log("\uD83C\uDF10 Dominio:", config2.domain);
var bridge2 = new BridgeServerEnhanced(config2);
process.on("SIGINT", () => {
  console.log(`
\uD83D\uDC4B Cerrando Bridge Server...`);
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log(`
\uD83D\uDC4B Cerrando Bridge Server...`);
  process.exit(0);
});
bridge2.start();
console.log(`
✅ Bridge Server iniciado correctamente`);
console.log("\uD83D\uDCD6 Los agentes deben conectarse con: AUTH <secreto> [subdominio]");
console.log("\uD83C\uDFAE Los jugadores deben conectarse a: <subdominio>.bridge.example.com:8080");
