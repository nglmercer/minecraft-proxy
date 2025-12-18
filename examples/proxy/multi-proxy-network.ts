import { startProxy } from '../../src/index.js';

// Ejemplo de red de proxies para múltiples servidores Minecraft
console.log('🏢 Iniciando Red de Proxies Minecraft...');

// Configuración de múltiples proxies para diferentes servidores
const proxyConfigs = [
    {
        name: 'Survival Proxy',
        proxyPort: 25566,
        minecraftHost: 'localhost',
        minecraftPort: 25565,
        debug: true
    },
    {
        name: 'Creative Proxy',
        proxyPort: 25567,
        minecraftHost: 'localhost',
        minecraftPort: 25570, // Diferente servidor
        debug: true
    },
    {
        name: 'Minigames Proxy',
        proxyPort: 25568,
        minecraftHost: 'localhost',
        minecraftPort: 25571, // Otro servidor diferente
        debug: true
    },
    {
        name: 'Hub Proxy',
        proxyPort: 25569,
        minecraftHost: 'localhost',
        minecraftPort: 25572, // Servidor hub/principal
        debug: false // Menos verbose
    }
];

// Array para almacenar las instancias de proxies
const proxies: any[] = [];

async function startProxyNetwork() {
    console.log('🔧 Configurando red de proxies...\n');
    
    for (const config of proxyConfigs) {
        try {
            console.log(`🚀 Iniciando ${config.name}...`);
            console.log(`   - Puerto proxy: ${config.proxyPort}`);
            console.log(`   - Servidor destino: ${config.minecraftHost}:${config.minecraftPort}`);
            
            const proxy = await startProxy({
                proxyPort: config.proxyPort,
                minecraftHost: config.minecraftHost,
                minecraftPort: config.minecraftPort,
                debug: config.debug
            });
            
            proxies.push({ name: config.name, proxy, config });
            
            console.log(`✅ ${config.name} iniciado correctamente\n`);
            
        } catch (error) {
            console.error(`❌ Error iniciando ${config.name}:`, error);
        }
    }
    
    console.log(`🎯 ${proxies.length} proxies iniciados exitosamente`);
    
    // Mostrar resumen de la red
    console.log('\n📊 Resumen de la Red de Proxies:');
    proxies.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.name}:`);
        console.log(`     - Puerto: ${item.config.proxyPort}`);
        console.log(`     - Destino: ${item.config.minecraftHost}:${item.config.minecraftPort}`);
        console.log(`     - Debug: ${item.config.debug ? 'ACTIVADO' : 'DESACTIVADO'}`);
    });
    
    console.log('\n🔗 URLs de conexión:');
    proxies.forEach((item) => {
        console.log(`  - ${item.name}: localhost:${item.config.proxyPort}`);
    });
    
    console.log('\n💡 Instrucciones:');
    console.log('   1. Asegúrate que todos los servidores Minecraft estén ejecutándose');
    console.log('   2. Los jugadores pueden conectarse a cualquier proxy');
    console.log('   3. Cada proxy redirige a su servidor correspondiente');
    console.log('   4. Útil para redes de servidores o balanceo de carga');
}

// Manejo de señales para cierre graceful
process.on('SIGINT', () => {
    console.log('\n👋 Cerrando red de proxies...');
    proxies.forEach((item, index) => {
        console.log(`  Deteniendo ${item.name}...`);
        if (item.proxy && typeof item.proxy.stop === 'function') {
            item.proxy.stop();
        }
    });
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Cerrando red de proxies...');
    proxies.forEach((item, index) => {
        console.log(`  Deteniendo ${item.name}...`);
        if (item.proxy && typeof item.proxy.stop === 'function') {
            item.proxy.stop();
        }
    });
    process.exit(0);
});

// Iniciar la red de proxies
startProxyNetwork().catch(error => {
    console.error('❌ Error crítico en la red de proxies:', error);
    process.exit(1);
});

// Información adicional sobre la configuración
setTimeout(() => {
    console.log('\n🔧 Configuración sugerida de servidores Minecraft:');
    console.log('   - Servidor Survival: localhost:25565');
    console.log('   - Servidor Creative: localhost:25570');
    console.log('   - Servidor Minigames: localhost:25571');
    console.log('   - Servidor Hub: localhost:25572');
    console.log('\n🎮 Los jugadores se conectan a:');
    console.log('   - Survival: localhost:25566');
    console.log('   - Creative: localhost:25567');
    console.log('   - Minigames: localhost:25568');
    console.log('   - Hub: localhost:25569');
}, 3000);