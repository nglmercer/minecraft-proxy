import { BridgeManager, BridgeServerEnhanced, BridgeServer } from '../../src/index.js';

// Ejemplo de múltiples bridges gestionados por un administrador
const bridgeManager = new BridgeManager();

console.log('🏢 Iniciando Multi-Bridge Manager...');

// Configuración para múltiples bridges en diferentes puertos
const bridgeConfigs = [
    {
        port: 8080,
        secret: 'bridge-1-secret',
        debug: true,
        domain: 'bridge1.example.com',
        auth: {
            enabled: true,
            secret: 'auth-secret-1',
            tokenExpiryHours: 24,
            codeExpiryMinutes: 30,
            maxTokensPerAgent: 5
        }
    },
    {
        port: 8081,
        secret: 'bridge-2-secret',
        debug: true,
        domain: 'bridge2.example.com',
        auth: {
            enabled: true,
            secret: 'auth-secret-2',
            tokenExpiryHours: 12,
            codeExpiryMinutes: 15,
            maxTokensPerAgent: 3
        }
    },
    {
        port: 8082,
        secret: 'bridge-3-secret',
        debug: false, // Menos verbose
        domain: 'bridge3.example.com',
        auth: {
            enabled: false, // Sin autenticación para este bridge
            secret: 'auth-secret-3'
        }
    }
];

// Crear instancias de bridges
const bridges = bridgeConfigs.map((config, index) => {
    console.log(`🔧 Creando Bridge ${index + 1} en puerto ${config.port}...`);
    
    try {
        let bridge: BridgeServer;
        
        // Crear instancia directamente con BridgeServerEnhanced si tiene auth habilitada
        if (config.auth.enabled) {
            bridge = new BridgeServerEnhanced(config);
            bridge.start();
            
            // Generar códigos para diferentes servidores
            const codes = [
                { agentId: `survival-${index + 1}`, namespace: 'survival' },
                { agentId: `creative-${index + 1}`, namespace: 'creative' },
                { agentId: `minigames-${index + 1}`, namespace: 'minigames' }
            ];
            
            codes.forEach(({ agentId, namespace }) => {
                const enhancedBridge = bridge as BridgeServerEnhanced;
                const code = enhancedBridge.generateClaimCode(agentId, namespace);
                console.log(`🎫 Bridge ${index + 1} - Código ${namespace}: ${code}`);
            });
        } else {
            bridge = bridgeManager.createInstance(config);
        }
        
        return bridge;
    } catch (error) {
        console.error(`❌ Error creando Bridge ${index + 1}:`, error);
        return null;
    }
}).filter(bridge => bridge !== null);

console.log(`\n✅ ${bridges.length} bridges iniciados correctamente`);

// Mostrar resumen
console.log('\n📊 Resumen de Bridges:');
bridgeManager.getAllInstances().forEach((bridge, index) => {
    const config = bridgeConfigs[index];
    if (config) {
        console.log(`  Bridge ${index + 1}: Puerto ${config.port}, Auth: ${config.auth.enabled ? 'ON' : 'OFF'}`);
    }
});

// Función para mostrar estadísticas periódicamente
setInterval(() => {
    console.log('\n📈 Estadísticas de Bridges:');
    bridgeManager.getAllInstances().forEach((bridge, index) => {
        const config = bridgeConfigs[index];
        if (config?.auth.enabled) {
            const enhancedBridge = bridge as unknown as BridgeServerEnhanced;
            const stats = enhancedBridge.getTokenStats();
            console.log(`  Bridge ${index + 1}:`, stats);
        } else {
            console.log(`  Bridge ${index + 1}: Auth deshabilitado`);
        }
    });
}, 60000); // Cada minuto

// Manejo de señales para cierre graceful
process.on('SIGINT', () => {
    console.log('\n👋 Cerrando Multi-Bridge Manager...');
    bridgeManager.getAllInstances().forEach((bridge, index) => {
        const config = bridgeConfigs[index];
        if (config) {
            console.log(`  Deteniendo Bridge ${index + 1}...`);
            bridgeManager.stopInstance(config.port);
        }
    });
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Cerrando Multi-Bridge Manager...');
    bridgeManager.getAllInstances().forEach((bridge, index) => {
        const config = bridgeConfigs[index];
        if (config) {
            console.log(`  Deteniendo Bridge ${index + 1}...`);
            bridgeManager.stopInstance(config.port);
        }
    });
    process.exit(0);
});

console.log('\n🎯 Todos los bridges están listos para recibir conexiones');
console.log('📖 Use Ctrl+C para detener todos los bridges');