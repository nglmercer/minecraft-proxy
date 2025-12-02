import { startProxy } from '../src/index.js';
async function main(
    listenPort: number = 25566,
    backendHost: string = 'localhost',
    backendPort: number = 25565,
    debug: boolean = true
) {
    try {
        const server = await startProxy({
            listenPort: listenPort,
            backendHost: backendHost,
            backendPort: backendPort,
            debug: debug,
        });

        return server;
    } catch (error) {
        return error;
    }
}
// You have a Minecraft Server running on port 25565.
// You want this Proxy to listen on port 25566 and forward traffic to it.
// Players will connect to: localhost:25566

const PROXY_PORT = process.env.PROXY_PORT ? parseInt(process.env.PROXY_PORT) : 25566; // <--- Changed to avoid conflict with your main server
const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT) : 25565; // <--- Your actual Minecraft Server port

console.log('Starting Minecraft Proxy Example...');
console.log(`1. Players connect to Proxy at:   localhost:${PROXY_PORT}`);
console.log(`2. Proxy forwards to Server at:   ${BACKEND_HOST}:${BACKEND_PORT}`);
main(PROXY_PORT, BACKEND_HOST, BACKEND_PORT, true).then((server) => {
    if (server instanceof Error) {
        console.error(server);
    }
})
