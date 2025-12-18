import { BridgeServer } from '../src/index.js';

// Railway Bridge Server
// This script is optimized for Railway deployment.

// In Railway, the PORT environment variable is automatically injected.
// This is the port your application must listen on.
const PORT = Number(process.env.PORT) || 8080; 

// Retrieve secret from environment variables for security
const SECRET = process.env.BRIDGE_SECRET || 'railway-secret-123';

console.log('--- Starting Railway Bridge ---');
console.log(`Listening on port (internal): ${PORT}`);
console.log(`Secret configured: ${SECRET ? 'Yes' : 'No'}`);

const bridge = new BridgeServer({
    port: PORT,
    secret: SECRET,
    // Si configuras un dominio propio (ej. "miserver.com"), el bridge podrá distinguir
    // entre "survival.miserver.com" y "lobby.miserver.com".
    domain: process.env.BRIDGE_DOMAIN || undefined, 
    debug: true,
});

bridge.start();

console.log('Railway Bridge is ready.');
console.log(`Ensure you have configured your TCP Proxy in Railway to forward to port ${PORT}.`);
