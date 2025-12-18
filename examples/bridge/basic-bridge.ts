import { BridgeServerEnhanced } from '../../src/index.js';

// Configuración básica del Bridge Server
const config = {
    port: 8080,
    secret: 'my-super-secret-key',
    debug: true,
    domain: 'bridge.example.com', // Dominio base para subdominios
    auth: {
        enabled: false, // Autenticación desactivada para este ejemplo
        secret: 'auth-secret-key'
    }
};

console.log('🚀 Iniciando Bridge Server Básico...');
console.log('📍 Puerto:', config.port);
console.log('🔑 Secreto compartido:', config.secret);
console.log('🌐 Dominio:', config.domain);

const bridge = new BridgeServerEnhanced(config);

// Manejo de señales para cierre graceful
process.on('SIGINT', () => {
    console.log('\n👋 Cerrando Bridge Server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Cerrando Bridge Server...');
    process.exit(0);
});

bridge.start();

console.log('\n✅ Bridge Server iniciado correctamente');
console.log('📖 Los agentes deben conectarse con: AUTH <secreto> [subdominio]');
console.log('🎮 Los jugadores deben conectarse a: <subdominio>.bridge.example.com:8080');