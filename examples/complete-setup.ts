import { BridgeServerEnhanced, TunnelAgent, startProxy } from '../src/index.js';

// Ejemplo completo: Bridge + Agent + Proxy + Autenticación
console.log('🚀 Ejemplo Completo: Sistema de Túneles Minecraft con Autenticación');
console.log('==================================================================\n');

// ===== CONFIGURACIÓN DEL SISTEMA =====
const SYSTEM_CONFIG = {
    // Bridge (VPS)
    bridge: {
        port: 8080,
        secret: 'bridge-master-secret',
        debug: true,
        domain: 'minecraft-tunnel.example.com',
        auth: {
            enabled: true,
            secret: 'auth-master-secret',
            tokenExpiryHours: 24,
            codeExpiryMinutes: 30,
            maxTokensPerAgent: 3
        }
    },
    
    // Agent (Casa)
    agent: {
        bridgeHost: 'localhost',
        bridgeControlPort: 8080,
        localHost: 'localhost',
        localPort: 25565,
        debug: true
    },
    
    // Proxy (Opcional - para red local)
    proxy: {
        enabled: true,
        proxyPort: 25566,
        minecraftHost: 'localhost',
        minecraftPort: 25565,
        debug: false
    }
};

// ===== INICIALIZAR BRIDGE =====
console.log('🏗️  Inicializando Bridge Server...');
const bridge = new BridgeServerEnhanced(SYSTEM_CONFIG.bridge);

// Generar códigos de reclamo para diferentes servidores
console.log('\n🎫 Generando códigos de reclamo:');
const servers = [
    { name: 'Survival', agentId: 'survival-main', namespace: 'sv' },
    { name: 'Creative', agentId: 'creative-main', namespace: 'cr' },
    { name: 'Minigames', agentId: 'minigames-main', namespace: 'mg' },
    { name: 'Hub', agentId: 'hub-main', namespace: 'hub' }
];

const claimCodes = servers.map(server => ({
    ...server,
    code: bridge.generateClaimCode(server.agentId, server.namespace)
}));

claimCodes.forEach(server => {
    console.log(`   ✓ ${server.name}: ${server.code}`);
});

// ===== INICIALIZAR AGENT =====
console.log('\n🤖 Inicializando Tunnel Agent...');
const firstServer = claimCodes[0];
if (!firstServer) {
    console.error('❌ Error: No se pudieron generar códigos de reclamo');
    process.exit(1);
}

const agent = new TunnelAgent({
    ...SYSTEM_CONFIG.agent,
    secret: firstServer.code // Usar el código del primer servidor
});

// ===== INICIALIZAR PROXY (OPCIONAL) =====
let proxy: any = null;
if (SYSTEM_CONFIG.proxy.enabled) {
    console.log('\n🔄 Inicializando Proxy Local...');
    
    startProxy({
        proxyPort: SYSTEM_CONFIG.proxy.proxyPort,
        minecraftHost: SYSTEM_CONFIG.proxy.minecraftHost,
        minecraftPort: SYSTEM_CONFIG.proxy.minecraftPort,
        debug: SYSTEM_CONFIG.proxy.debug
    }).then(server => {
        proxy = server;
        console.log(`   ✓ Proxy escuchando en puerto ${SYSTEM_CONFIG.proxy.proxyPort}`);
    }).catch(error => {
        console.error(`   ❌ Error iniciando proxy:`, error);
    });
}

// ===== INFORMACIÓN DE CONEXIÓN =====
function showConnectionInfo() {
    console.log('\n📋 Información de Conexión:');
    console.log('============================');
    
    console.log('\n🔧 Bridge Server:');
    console.log(`   - Puerto: ${SYSTEM_CONFIG.bridge.port}`);
    console.log(`   - Dominio: ${SYSTEM_CONFIG.bridge.domain}`);
    console.log(`   - Autenticación: ${SYSTEM_CONFIG.bridge.auth.enabled ? 'HABILITADA' : 'DESACTIVADA'}`);
    
    console.log('\n🤖 Tunnel Agent:');
    console.log(`   - Conectando a: ${SYSTEM_CONFIG.agent.bridgeHost}:${SYSTEM_CONFIG.agent.bridgeControlPort}`);
    console.log(`   - Redirigiendo a: ${SYSTEM_CONFIG.agent.localHost}:${SYSTEM_CONFIG.agent.localPort}`);
    
    if (SYSTEM_CONFIG.proxy.enabled && proxy) {
        console.log('\n🔄 Proxy Local:');
        console.log(`   - Puerto: ${SYSTEM_CONFIG.proxy.proxyPort}`);
        console.log(`   - Redirige a: ${SYSTEM_CONFIG.proxy.minecraftHost}:${SYSTEM_CONFIG.proxy.minecraftPort}`);
    }
    
    console.log('\n🎮 Para Jugadores:');
    servers.forEach(server => {
        console.log(`   - ${server.name}: ${server.namespace}.${SYSTEM_CONFIG.bridge.domain}:${SYSTEM_CONFIG.bridge.port}`);
    });
    
    console.log('\n🔑 Códigos de Reclamo (Agentes):');
    claimCodes.forEach(server => {
        console.log(`   - ${server.name}: ${server.code}`);
    });
    
    console.log('\n📊 Estadísticas del Bridge:');
    const stats = bridge.getTokenStats();
    console.log(stats);
}

// ===== INICIAR SERVICIOS =====
console.log('\n🚀 Iniciando servicios...');

// Iniciar Bridge
bridge.start();

// Iniciar Agent
agent.start();

// Mostrar información después de unos segundos
setTimeout(() => {
    showConnectionInfo();
    
    console.log('\n✅ Sistema completamente iniciado');
    console.log('📡 Esperando conexiones...');
    console.log('\n💡 Comandos útiles:');
    console.log('   - Para ver esta información nuevamente: Ctrl+C y reiniciar');
    console.log('   - Los agentes pueden usar códigos o tokens para autenticarse');
    console.log('   - Los jugadores se conectan usando subdominios');
    
}, 2000);

// ===== MANEJO DE SEÑALES =====
process.on('SIGINT', () => {
    console.log('\n👋 Cerrando sistema completo...');
    
    if (proxy && typeof proxy.stop === 'function') {
        console.log('   Deteniendo proxy...');
        proxy.stop();
    }
    
    console.log('   Sistema detenido');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Cerrando sistema completo...');
    
    if (proxy && typeof proxy.stop === 'function') {
        console.log('   Deteniendo proxy...');
        proxy.stop();
    }
    
    console.log('   Sistema detenido');
    process.exit(0);
});

// ===== MONITOREO =====
setInterval(() => {
    console.log('\n📊 Actualización de estadísticas:');
    const stats = bridge.getTokenStats();
    console.log(`   - Tokens activos: ${typeof stats === 'object' && 'activeTokens' in stats ? stats.activeTokens : 'N/A'}`);
    console.log(`   - Códigos activos: ${typeof stats === 'object' && 'activeCodes' in stats ? stats.activeCodes : 'N/A'}`);
}, 60000); // Cada minuto

console.log('\n⏳ Inicialización completada. El sistema está operativo.');