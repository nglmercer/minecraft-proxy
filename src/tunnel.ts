/**
 * Tunnel manager for bidirectional data flow between two sockets.
 */

type Socket = any; // To avoid TypeScript issues with Bun's Socket

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
  client: Socket,
  backend: Socket,
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

    if (!clientClosed && client.readyState === 'open') {
      client.end();
      clientClosed = true;
    }

    if (!backendClosed && backend.readyState === 'open') {
      backend.end();
      backendClosed = true;
    }

    if (onClose) {
      onClose();
    }
  };

  // Forward client data to backend
  client.data = (data: Buffer) => {
    if (backend.readyState === 'open') {
      backend.write(data);
    } else {
      closeTunnel();
    }
  };

  // Forward backend data to client
  backend.data = (data: Buffer) => {
    if (client.readyState === 'open') {
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
