import { BridgeServer, TunnelAgent } from '../src/index.js';

// --- CONFIGURACIÓN ---
// Tu servidor de Minecraft REAL en tu PC
const MINECRAFT_PORT = 25565;

// Puertos simulados para el VPS (Bridge)
const VPS_PUBLIC_PORT = 25567; // Los jugadores entrarán por aquí (localhost:25567)
const VPS_CONTROL_PORT = 8080; // Puerto interno de comunicación
const SECRET = 'test-secret';

console.log('--- INICIANDO PRUEBA DE TÚNEL INVERSO (LOCAL) ---');

// 1. Iniciar el "VPS" (Bridge)
// Esto normalmente correría en tu servidor en la nube.
console.log(`[VPS] Iniciando Bridge...`);
console.log(`[VPS] Jugadores conectarán a: localhost:${VPS_PUBLIC_PORT}`);
const bridge = new BridgeServer({
    publicPort: VPS_PUBLIC_PORT,
    controlPort: VPS_CONTROL_PORT,
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
    bridgeControlPort: VPS_CONTROL_PORT,
    localHost: 'localhost',
    localPort: MINECRAFT_PORT,
    secret: SECRET,
    debug: true,
});
agent.start();

console.log('\n--- SISTEMA LISTO ---');
console.log(`PRUEBA: Abre Minecraft y conéctate a 'localhost:${VPS_PUBLIC_PORT}'`);
console.log(`El tráfico viajará: Cliente -> VPS Falso -> Agente -> Tu Minecraft`);
