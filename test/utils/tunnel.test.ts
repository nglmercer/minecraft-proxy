import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { createTunnel } from '../../src';
describe('Tunnel', () => {
  let mockClient: any;
  let mockBackend: any;
  let onClose: ReturnType<typeof mock>;
  let onError: ReturnType<typeof mock>;

  beforeEach(() => {
    onClose = mock();
    onError = mock();

    // Create mock objects with getters and setters for event handlers
    // so we can capture the assigned functions
    let clientDataHandler: Function | undefined;
    let clientCloseHandler: Function | undefined;
    let clientErrorHandler: Function | undefined;
    let backendDataHandler: Function | undefined;
    let backendCloseHandler: Function | undefined;
    let backendErrorHandler: Function | undefined;

    mockClient = {
      readyState: 'open',
      end: mock(),
      write: mock(),
      get data() { return clientDataHandler; },
      set data(handler: Function | undefined) { clientDataHandler = handler; },
      get close() { return clientCloseHandler; },
      set close(handler: Function | undefined) { clientCloseHandler = handler; },
      get error() { return clientErrorHandler; },
      set error(handler: Function | undefined) { clientErrorHandler = handler; },
      // Helper to trigger data event
      triggerData(data: Buffer) {
        if (clientDataHandler) clientDataHandler(data);
      },
      // Helper to trigger close event
      triggerClose() {
        if (clientCloseHandler) clientCloseHandler();
      },
      // Helper to trigger error event
      triggerError(error: Error) {
        if (clientErrorHandler) clientErrorHandler(error);
      },
    };

    mockBackend = {
      readyState: 'open',
      end: mock(),
      write: mock(),
      get data() { return backendDataHandler; },
      set data(handler: Function | undefined) { backendDataHandler = handler; },
      get close() { return backendCloseHandler; },
      set close(handler: Function | undefined) { backendCloseHandler = handler; },
      get error() { return backendErrorHandler; },
      set error(handler: Function | undefined) { backendErrorHandler = handler; },
      // Helper to trigger data event
      triggerData(data: Buffer) {
        if (backendDataHandler) backendDataHandler(data);
      },
      // Helper to trigger close event
      triggerClose() {
        if (backendCloseHandler) backendCloseHandler();
      },
      // Helper to trigger error event
      triggerError(error: Error) {
        if (backendErrorHandler) backendErrorHandler(error);
      },
    };
  });

  afterEach(() => {
    mockClient.end.mockClear();
    mockBackend.end.mockClear();
    mockClient.write.mockClear();
    mockBackend.write.mockClear();
    onClose.mockClear();
    onError.mockClear();
  });

  test('should forward data from client to backend', () => {
    createTunnel(mockClient, mockBackend, { onClose, onError });

    const testData = Buffer.from('test data');
    mockClient.triggerData(testData);

    expect(mockBackend.write).toHaveBeenCalledWith(testData);
    expect(mockClient.end).not.toHaveBeenCalled();
    expect(mockBackend.end).not.toHaveBeenCalled();
  });

  test('should forward data from backend to client', () => {
    createTunnel(mockClient, mockBackend, { onClose, onError });

    const testData = Buffer.from('backend data');
    mockBackend.triggerData(testData);

    expect(mockClient.write).toHaveBeenCalledWith(testData);
    expect(mockClient.end).not.toHaveBeenCalled();
    expect(mockBackend.end).not.toHaveBeenCalled();
  });

  test('should close the other side when client closes', () => {
    createTunnel(mockClient, mockBackend, { onClose, onError });

    mockClient.triggerClose();

    // Client is already closing, so we don't call end on it
    expect(mockClient.end).not.toHaveBeenCalled();
    // Backend should be closed
    expect(mockBackend.end).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('should close the other side when backend closes', () => {
    createTunnel(mockClient, mockBackend, { onClose, onError });

    mockBackend.triggerClose();

    // Backend is already closing, so we don't call end on it
    expect(mockBackend.end).not.toHaveBeenCalled();
    // Client should be closed
    expect(mockClient.end).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('should handle client error', () => {
    createTunnel(mockClient, mockBackend, { onClose, onError });

    const testError = new Error('Client error');
    mockClient.triggerError(testError);

    // On error, we close both sides
    expect(mockClient.end).toHaveBeenCalled();
    expect(mockBackend.end).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(testError);
    expect(onClose).toHaveBeenCalled();
  });

  test('should handle backend error', () => {
    createTunnel(mockClient, mockBackend, { onClose, onError });

    const testError = new Error('Backend error');
    mockBackend.triggerError(testError);

    // On error, we close both sides
    expect(mockClient.end).toHaveBeenCalled();
    expect(mockBackend.end).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(testError);
    expect(onClose).toHaveBeenCalled();
  });

  test('should not forward data if the other side is closed', () => {
    mockBackend.readyState = 'closed';
    createTunnel(mockClient, mockBackend, { onClose, onError });

    const testData = Buffer.from('test');
    mockClient.triggerData(testData);

    // Should not call write because backend is closed
    expect(mockBackend.write).not.toHaveBeenCalled();
    // Should close the tunnel (client side, backend is already closed)
    expect(mockClient.end).toHaveBeenCalled();
    // Backend is already closed, so we don't call end on it
    expect(mockBackend.end).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  test('debug logging option', () => {
    const consoleLog = console.log;
    const mockLog = mock();
    console.log = mockLog;

    try {
      createTunnel(mockClient, mockBackend, { debug: true });
      expect(mockLog).toHaveBeenCalledWith('Tunnel established');
    } finally {
      console.log = consoleLog;
    }
  });
});
