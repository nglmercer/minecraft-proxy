import { BridgeServer, TunnelAgent } from '../src/index.js';

// --- CONFIGURACIÓN ---
// Tu servidor de Minecraft REAL en tu PC
const MINECRAFT_PORT = 25565;

// Puertos simulados para el VPS (Bridge)
const BRIDGE_PORT = 25567; // Puerto único (Multiplexado: Control + Jugadores)
const SECRET = 'test-secret';

console.log('--- INICIANDO PRUEBA DE TÚNEL INVERSO (LOCAL) ---');

// 1. Iniciar el "VPS" (Bridge)
// Esto normalmente correría en tu servidor en la nube.
console.log(`[VPS] Iniciando Bridge...`);
console.log(`[VPS] Jugadores conectarán a: localhost:${BRIDGE_PORT}`);
const bridge = new BridgeServer({
    port: BRIDGE_PORT,
    secret: SECRET,
    debug: true,
});
bridge.start();

// 2. Iniciar el "Agente" (Casa)
// Esto corre en tu PC junto a tu Minecraft.
console.log(`[CASA] Iniciando Agente...`);
console.log(`[CASA] Conectando al VPS y redirigiendo a Minecraft :${MINECRAFT_PORT}`);
const agent = new TunnelAgent({
    bridgeHost: 'localhost', // En la vida real, aquí iría la IP de tu VPS (ej. 1.2.3.4)
    bridgeControlPort: BRIDGE_PORT,
    localHost: 'localhost',
    localPort: MINECRAFT_PORT,
    secret: SECRET,
    debug: true,
});
agent.start();

console.log('\n--- SISTEMA LISTO ---');
console.log(`PRUEBA: Abre Minecraft y conéctate a 'localhost:${BRIDGE_PORT}'`);
console.log(`El tráfico viajará: Cliente -> VPS Falso -> Agente -> Tu Minecraft`);
