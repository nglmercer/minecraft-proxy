/**
 * Tunnel manager for bidirectional data flow between two sockets.
 */

// Define the expected interface for Sockets used in this tunnel.
// Note: This expects sockets to allow assigning handlers to .data, .close, .error properties.
// Standard Bun Sockets might not behave this way directly unless wrapped or polyfilled.
export interface TunnelSocket {
    readyState: 'open' | 'closed' | string | number;
    write(data: Uint8Array | Buffer): void | number;
    end(): void;
    // Handler setters
    data: (data: Buffer) => void;
    close: () => void;
    error: (error: Error) => void;
    // Allow other properties
    [key: string]: unknown;
}

export interface TunnelOptions {
  /** Callback when tunnel is closed */
  onClose?: () => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Creates a tunnel between a client socket and a backend socket.
 * Data from client is forwarded to backend, and vice versa.
 * Automatically cleans up when either side closes.
 */
export function createTunnel(
  client: TunnelSocket,
  backend: TunnelSocket,
  options: TunnelOptions = {}
): void {
  const { onClose, onError, debug = false } = options;

  const log = debug ? console.log : () => {};

  let clientClosed = false;
  let backendClosed = false;

  const closeTunnel = () => {
    if (clientClosed && backendClosed) {
      return;
    }

    log('Closing tunnel');

    if (!clientClosed && (client.readyState === 'open' || client.readyState === 1)) {
      client.end();
      clientClosed = true;
    }

    if (!backendClosed && (backend.readyState === 'open' || backend.readyState === 1)) {
      backend.end();
      backendClosed = true;
    }

    if (onClose) {
      onClose();
    }
  };

  // Forward client data to backend
  client.data = (data: Buffer) => {
    if (backend.readyState === 'open' || backend.readyState === 1) {
      backend.write(data);
    } else {
      closeTunnel();
    }
  };

  // Forward backend data to client
  backend.data = (data: Buffer) => {
    if (client.readyState === 'open' || client.readyState === 1) {
      client.write(data);
    } else {
      closeTunnel();
    }
  };

  // Handle client close
  client.close = () => {
    log('Client disconnected');
    clientClosed = true;
    closeTunnel();
  };

  // Handle backend close
  backend.close = () => {
    log('Backend disconnected');
    backendClosed = true;
    closeTunnel();
  };

  // Handle errors
  client.error = (error: Error) => {
    log(`Client socket error: ${error}`);
    if (onError) {
      onError(error);
    }
    closeTunnel();
  };

  backend.error = (error: Error) => {
    log(`Backend socket error: ${error}`);
    if (onError) {
      onError(error);
    }
    closeTunnel();
  };

  log('Tunnel established');
}
