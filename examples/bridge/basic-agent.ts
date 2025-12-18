import { TunnelAgent } from '../../src/index.js';

// Configuración básica del agente de túnel
const config = {
    bridgeHost: 'localhost', // IP del VPS Bridge
    bridgeControlPort: 8080, // Puerto del Bridge
    localHost: 'localhost', // IP del servidor Minecraft local
    localPort: 25565, // Puerto del servidor Minecraft local
    secret: 'my-super-secret-key', // Secreto compartido con el Bridge
    debug: true
};

console.log('🚀 Iniciando Tunnel Agent Básico...');
console.log('📡 Conectando al Bridge:', `${config.bridgeHost}:${config.bridgeControlPort}`);
console.log('🎮 Redirigiendo a Minecraft:', `${config.localHost}:${config.localPort}`);
console.log('🔑 Usando autenticación por secreto compartido');

const agent = new TunnelAgent(config);

// Manejo de eventos del agente
agent.start();

console.log('\n✅ Agente iniciado correctamente');
console.log('📡 Intentando conexión con el Bridge...');
console.log('⏳ Esperando instrucciones del Bridge...');

// Manejo de señales para cierre graceful
process.on('SIGINT', () => {
    console.log('\n👋 Deteniendo Tunnel Agent...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Deteniendo Tunnel Agent...');
    process.exit(0);
});

// Simular información de conexión
setTimeout(() => {
    console.log('\n📋 Información de conexión:');
    console.log('🔌 Protocolo: AUTH <secreto> [subdominio]');
    console.log('🎯 Ejemplo: AUTH my-super-secret-key survival-01');
    console.log('🌐 Jugadores conectarán a: survival-01.bridge.example.com:8080');
}, 2000);