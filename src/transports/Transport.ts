
export interface Connection {
    write(data: Uint8Array): void | Promise<void>;
    close(): void;
    // Event handling could be via methods or EventEmitter style. Methods are simpler for now.
    on(event: 'data', listener: (data: Uint8Array) => void): void;
    on(event: 'close', listener: () => void): void;
    on(event: 'error', listener: (err: Error) => void): void;
    
    remoteAddress?: string;
    remotePort?: number;
    
    // Abstract data storage
    data?: Record<string, unknown>;
}

export interface Transport {
    listen(port: number, host?: string): Promise<void>;
    onConnection(listener: (connection: Connection) => void): void;
    close(): void;
}
