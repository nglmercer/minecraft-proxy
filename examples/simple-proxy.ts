import { startProxy } from '../src/index.js';

// Example: Start a proxy on port 25565 that forwards to a backend on port 25575
// To test this, you would need a Minecraft server running on port 25575.

// SCENARIO:
// You have a Minecraft Server running on port 25565.
// You want this Proxy to listen on port 25566 and forward traffic to it.
// Players will connect to: localhost:25566

const PROXY_PORT = 25566; // <--- Changed to avoid conflict with your main server
const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 25565; // <--- Your actual Minecraft Server port

console.log('Starting Minecraft Proxy Example...');
console.log(`1. Players connect to Proxy at:   localhost:${PROXY_PORT}`);
console.log(`2. Proxy forwards to Server at:   ${BACKEND_HOST}:${BACKEND_PORT}`);

try {
    const server = await startProxy({
        listenPort: PROXY_PORT,
        backendHost: BACKEND_HOST,
        backendPort: BACKEND_PORT,
        debug: true, // Enable debug logs to see what's happening
    });

    console.log('Proxy started successfully!');
    console.log('Press Ctrl+C to stop.');
} catch (error) {
    console.error('Failed to start proxy:', error);
}
