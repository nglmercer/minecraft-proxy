import { startProxy } from '../src/index.js';

// Example: Running multiple proxies for different backend servers
// Useful for a hub server or network setup

async function main() {
    console.log('Starting Multi-Proxy Network...');

    // Proxy 1: Survival Server
    // Listens on 25566 -> Forwards to 25565
    const survivalProxy = await startProxy({
        proxyPort: 25566,
        minecraftHost: 'localhost',
        minecraftPort: 25565,
        debug: true,
    });
    console.log('Survival Proxy listening on :25566 -> :25565');

    // Proxy 2: Creative Server
    // Listens on 25567 -> Forwards to 25565
    const creativeProxy = await startProxy({
        proxyPort: 25567,
        minecraftHost: 'localhost',
        minecraftPort: 25565,
        debug: true,
    });
    console.log('Creative Proxy listening on :25567 -> :25565');

    console.log('All proxies started. Press Ctrl+C to stop.');
}

main().catch(console.error);
