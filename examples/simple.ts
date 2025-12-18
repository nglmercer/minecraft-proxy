import { startProxy } from '../src/index.js';

// Simple TCP Proxy Example
// Useful for forwarding a port on the same machine or to another machine on the LAN.

async function main() {
    // Configuration
    const LISTEN_PORT = 25566;        // Port players will connect to
    const TARGET_HOST = 'localhost';  // Destination Host (e.g., Minecraft Server)
    const TARGET_PORT = 25565;        // Destination Port

    console.log(`Starting Simple Proxy...`);
    console.log(`Listening on: 0.0.0.0:${LISTEN_PORT}`);
    console.log(`Forwarding to: ${TARGET_HOST}:${TARGET_PORT}`);

    try {
        const server = await startProxy({
            proxyPort: LISTEN_PORT,
            minecraftHost: TARGET_HOST,
            minecraftPort: TARGET_PORT,
            debug: true, // Set to false to reduce logs
        });

        console.log('Proxy is running! Press Ctrl+C to stop.');
    } catch (error) {
        console.error('Failed to start proxy:', error);
    }
}

main();
