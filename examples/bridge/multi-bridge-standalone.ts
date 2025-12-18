import { BridgeServerEnhanced } from '../../src/index.js';

// Ejemplo de múltiples bridges independientes con diferentes configuraciones
const bridges: BridgeServerEnhanced[] = [];

console.log('🏢 Iniciando Multi-Bridge Setup (Independiente)...');

// Configuración para múltiples bridges
const bridgeConfigs = [
    {
        name: 'Bridge Survival',
        port: 8080,
        secret: 'bridge-survival-secret',
        debug: true,
        domain: 'survival.bridge.example.com',
        auth: {
            enabled: true,
            secret: 'auth-survival-secret',
            tokenExpiryHours: 24,
            codeExpiryMinutes: 30,
            maxTokensPerAgent: 5
        }
    },
    {
        name: 'Bridge Creative',
        port: 8081,
        secret: 'bridge-creative-secret',
        debug: true,
        domain: 'creative.bridge.example.com',
        auth: {
            enabled: true,
            secret: 'auth-creative-secret',
            tokenExpiryHours: 12,
            codeExpiryMinutes: 15,
            maxTokensPerAgent: 3
        }
    },
    {
        name: 'Bridge Minigames',
        port: 8082,
        secret: 'bridge-minigames-secret',
        debug: false,
        domain: 'minigames.bridge.example.com',
        auth: {
            enabled: false, // Sin autenticación para este bridge
            secret: 'auth-minigames-secret'
        }
    }
];

// Crear y configurar cada bridge
bridgeConfigs.forEach((config, index) => {
    console.log(`\n🔧 Configurando ${config.name}...`);
    
    try {
        const bridge = new BridgeServerEnhanced({
            port: config.port,
            secret: config.secret,
            debug: config.debug,
            domain: config.domain,
            auth: config.auth
        });
        
        bridges.push(bridge);
        
        // Generar códigos de ejemplo para bridges con auth habilitada
        if (config.auth.enabled) {
            console.log(`🎫 Generando códigos para ${config.name}:`);
            
            // Generar códigos para diferentes servidores
            const codes = [
                { agentId: `${config.name.toLowerCase().replace(' ', '-')}-01`, namespace: 'main' },
                { agentId: `${config.name.toLowerCase().replace(' ', '-')}-02`, namespace: 'backup' },
                { agentId: `${config.name.toLowerCase().replace(' ', '-')}-03`, namespace: 'test' }
            ];
            
            codes.forEach(({ agentId, namespace }) => {
                const code = bridge.generateClaimCode(agentId, namespace);
                console.log(`   - ${namespace}: ${code}`);
            });
        } else {
            console.log(`🔓 ${config.name} sin autenticación - conexión directa con secreto`);
        }
        
        // Iniciar el bridge
        bridge.start();
        console.log(`✅ ${config.name} iniciado en puerto ${config.port}`);
        
    } catch (error) {
        console.error(`❌ Error iniciando ${config.name}:`, error);
    }
});

console.log(`\n🎯 ${bridges.length} bridges configurados exitosamente`);

// Mostrar resumen
console.log('\n📊 Resumen de Bridges:');
bridges.forEach((bridge, index) => {
    const config = bridgeConfigs[index];
    if (config) {
        console.log(`  ${index + 1}. ${config.name}:`);
        console.log(`     - Puerto: ${config.port}`);
        console.log(`     - Dominio: ${config.domain}`);
        console.log(`     - Auth: ${config.auth.enabled ? 'HABILITADA' : 'DESACTIVADA'}`);
        
        const stats = bridge.getTokenStats();
        if (typeof stats === 'object' && 'activeTokens' in stats) {
            console.log(`     - Tokens activos: ${stats.activeTokens}`);
        } else {
            console.log(`     - Tokens activos: N/A`);
        }
    }
});

// Función para mostrar estadísticas periódicamente
setInterval(() => {
    console.log('\n📈 Estadísticas de Bridges:');
    bridges.forEach((bridge, index) => {
        const config = bridgeConfigs[index];
        if (config) {
            const stats = bridge.getTokenStats();
            console.log(`  ${config.name}:`, stats);
        }
    });
}, 30000); // Cada 30 segundos

// Manejo de señales para cierre graceful
process.on('SIGINT', () => {
    console.log('\n👋 Cerrando todos los bridges...');
    bridges.forEach((bridge, index) => {
        const config = bridgeConfigs[index];
        if (config) {
            console.log(`  Deteniendo ${config.name}...`);
            // Nota: Actualmente no hay método stop() implementado
        }
    });
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Cerrando todos los bridges...');
    bridges.forEach((bridge, index) => {
        const config = bridgeConfigs[index];
        if (config) {
            console.log(`  Deteniendo ${config.name}...`);
        }
    });
    process.exit(0);
});

console.log('\n🚀 Todos los bridges están listos para recibir conexiones');
console.log('📖 Use Ctrl+C para detener todos los bridges');
console.log('\n🔗 URLs de conexión:');
bridgeConfigs.forEach((config) => {
    console.log(`  - ${config.name}: ${config.domain}:${config.port}`);
});