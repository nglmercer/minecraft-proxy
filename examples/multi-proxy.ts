import { startProxy } from '../src/index.js';

// Example: Running multiple proxies for different backend servers
// Useful for a hub server or network setup

async function main() {
    console.log('Starting Multi-Proxy Network...');

    // Proxy 1: Survival Server
    // Listens on 25565 -> Forwards to 25575
    const survivalProxy = await startProxy({
        listenPort: 25565,
        backendHost: 'localhost',
        backendPort: 25575,
        debug: true,
    });
    console.log('Survival Proxy listening on :25565 -> :25575');

    // Proxy 2: Creative Server
    // Listens on 25566 -> Forwards to 25576
    const creativeProxy = await startProxy({
        listenPort: 25566,
        backendHost: 'localhost',
        backendPort: 25576,
        debug: true,
    });
    console.log('Creative Proxy listening on :25566 -> :25576');

    console.log('All proxies started. Press Ctrl+C to stop.');
}

main().catch(console.error);
