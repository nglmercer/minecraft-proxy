import { startProxy } from '../../src/index.js';

// Configuración básica del proxy
const config = {
    proxyPort: 25566, // Puerto donde escuchará el proxy
    minecraftHost: 'localhost', // IP del servidor Minecraft real
    minecraftPort: 25565, // Puerto del servidor Minecraft real
    debug: true
};

console.log('🚀 Iniciando Proxy Minecraft Básico...');
console.log('📋 Configuración:');
console.log(`   - Proxy escuchando en: localhost:${config.proxyPort}`);
console.log(`   - Redirigiendo a: ${config.minecraftHost}:${config.minecraftPort}`);

async function main() {
    try {
        const server = await startProxy(config);
        
        console.log('\n✅ Proxy iniciado correctamente');
        console.log('📡 Esperando conexiones de jugadores...');
        console.log('\n💡 Instrucciones:');
        console.log(`   1. Asegúrate que tu servidor Minecraft esté ejecutándose en ${config.minecraftHost}:${config.minecraftPort}`);
        console.log(`   2. Los jugadores deben conectarse a: localhost:${config.proxyPort}`);
        console.log('   3. El proxy redirigirá el tráfico automáticamente');
        
        // Manejo de señales para cierre graceful
        process.on('SIGINT', () => {
            console.log('\n👋 Cerrando Proxy...');
            if (server && typeof server.stop === 'function') {
                server.stop();
            }
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\n👋 Cerrando Proxy...');
            if (server && typeof server.stop === 'function') {
                server.stop();
            }
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error iniciando el proxy:', error);
        process.exit(1);
    }
}

main();

// Información adicional
setTimeout(() => {
    console.log('\n🔧 Información técnica:');
    console.log('   - Protocolo: Minecraft Handshake');
    console.log('   - Tipo: Proxy transparente');
    console.log('   - Propósito: Redirección de tráfico');
    console.log('   - Compatibilidad: Minecraft Java Edition');
}, 1000);