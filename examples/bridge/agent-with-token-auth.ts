import { TunnelAgent } from '../../src/index.js';

// Configuración del agente con autenticación por token
const config = {
    bridgeHost: 'localhost', // IP del VPS Bridge
    bridgeControlPort: 8080, // Puerto del Bridge
    localHost: 'localhost', // IP del servidor Minecraft local
    localPort: 25566, // Puerto del servidor Minecraft local (diferente al ejemplo básico)
    secret: 'token-auth-secret', // Token o código de reclamo
    debug: true
};

console.log('🚀 Iniciando Tunnel Agent con Autenticación por Token...');
console.log('📡 Conectando al Bridge:', `${config.bridgeHost}:${config.bridgeControlPort}`);
console.log('🎮 Redirigiendo a Minecraft:', `${config.localHost}:${config.localPort}`);

// Simular diferentes métodos de autenticación
const authMethods = [
    {
        name: 'Código de Reclamo',
        secret: 'ABC123', // Código de 6 caracteres generado por el Bridge
        description: 'Usar un código de reclamo temporal'
    },
    {
        name: 'Token Existente',
        secret: 'existing-token-12345', // Token previamente generado
        description: 'Usar un token existente'
    },
    {
        name: 'Secreto Compartido',
        secret: 'shared-secret-key', // Secreto compartido (fallback)
        description: 'Usar secreto compartido tradicional'
    }
];

// Seleccionar método de autenticación (cambiar el índice para probar diferentes métodos)
const selectedAuth = authMethods[0]; // Cambiar entre 0, 1, 2

if (selectedAuth) {
    console.log(`\n🔑 Método de autenticación: ${selectedAuth.name}`);
    console.log(`📝 Descripción: ${selectedAuth.description}`);
    console.log(`🔐 Secreto/Token: ${selectedAuth.secret}`);

    // Actualizar configuración con el método seleccionado
    config.secret = selectedAuth.secret;
} else {
    console.log('\n❌ Error: No se seleccionó un método de autenticación válido');
    process.exit(1);
}

const agent = new TunnelAgent(config);

// Manejo de eventos del agente
agent.start();

console.log('\n✅ Agente configurado con autenticación avanzada');
console.log('📡 Intentando autenticación con el Bridge...');

// Manejo de señales para cierre graceful
process.on('SIGINT', () => {
    console.log('\n👋 Deteniendo Tunnel Agent...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Deteniendo Tunnel Agent...');
    process.exit(0);
});

// Simular diferentes escenarios
setTimeout(() => {
    console.log('\n📋 Escenarios de autenticación:');
    console.log('1️⃣ Código de reclamo: AUTH ABC123');
    console.log('2️⃣ Token existente: AUTH existing-token-12345');
    console.log('3️⃣ Secreto compartido: AUTH shared-secret-key');
    console.log('\n💡 El Bridge determinará el tipo de credencial automáticamente');
    console.log('🔄 Si falla, el agente intentará reconectar en 5 segundos');
}, 3000);

// Simular múltiples agentes (descomentar para probar)
/*
console.log('\n🔄 Iniciando múltiples instancias de agentes...');

const multiAgentConfigs = [
    { port: 25566, name: 'Survival' },
    { port: 25567, name: 'Creative' },
    { port: 25568, name: 'Minigames' }
];

multiAgentConfigs.forEach((serverConfig, index) => {
    setTimeout(() => {
        console.log(`🚀 Iniciando agente para ${serverConfig.name}...`);
        
        const multiAgent = new TunnelAgent({
            bridgeHost: 'localhost',
            bridgeControlPort: 8080,
            localHost: 'localhost',
            localPort: serverConfig.port,
            secret: `multi-agent-token-${index + 1}`,
            debug: false
        });
        
        multiAgent.start();
    }, index * 2000); // Stagger start times
});
*/