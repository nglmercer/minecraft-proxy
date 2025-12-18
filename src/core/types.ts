
import type { Connection } from '../transports/Transport';
export type Listener<T extends any[] = any[]> = (...args: T) => void;

export interface SocketData {
    connection?: Connection;
    listeners?: Record<string, Listener[]>;
    // For specific implementations
    [key: string]: unknown;
}

export type ConnectionEvent = 'data' | 'close' | 'error';
