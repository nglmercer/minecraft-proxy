import { BridgeServerEnhanced } from '../../src/index.js';

// Configuración del Bridge Server con autenticación avanzada
const config = {
    port: 8080,
    secret: 'fallback-secret-key', // Secreto de respaldo para compatibilidad
    debug: true,
    domain: 'bridge.example.com',
    auth: {
        enabled: true, // 🔐 Autenticación habilitada
        secret: 'auth-master-secret-key',
        tokenExpiryHours: 24, // Tokens válidos por 24 horas
        codeExpiryMinutes: 30, // Códigos de reclamo válidos por 30 minutos
        maxTokensPerAgent: 3 // Máximo 3 tokens por agente
    }
};

console.log('🚀 Iniciando Bridge Server con Autenticación Avanzada...');
console.log('📍 Puerto:', config.port);
console.log('🌐 Dominio:', config.domain);
console.log('🔐 Autenticación:', config.auth.enabled ? 'HABILITADA' : 'DESACTIVADA');

const bridge = new BridgeServerEnhanced(config);

// Generar algunos códigos de ejemplo
console.log('\n🎫 Generando códigos de reclamo de ejemplo...');

// Código para el agente de supervivencia
const survivalCode = bridge.generateClaimCode('survival-01', 'survival');
console.log('🎮 Código para servidor Survival:', survivalCode);

// Código para el agente de creativo
const creativeCode = bridge.generateClaimCode('creative-01', 'creative');
console.log('🎨 Código para servidor Creative:', creativeCode);

// Código para el agente de minijuegos
const minigamesCode = bridge.generateClaimCode('minigames-01', 'minigames');
console.log('🎯 Código para servidor Minigames:', minigamesCode);

console.log('\n📋 Instrucciones de uso:');
console.log('1️⃣ Los agentes pueden usar códigos de reclamo: AUTH <código>');
console.log('2️⃣ Los agentes pueden usar tokens: AUTH <token>');
console.log('3️⃣ Los jugadores conectan a: <namespace>.bridge.example.com:8080');

// Manejo de señales para cierre graceful
process.on('SIGINT', () => {
    console.log('\n👋 Cerrando Bridge Server...');
    console.log('📊 Estadísticas finales:', bridge.getTokenStats());
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Cerrando Bridge Server...');
    console.log('📊 Estadísticas finales:', bridge.getTokenStats());
    process.exit(0);
});

bridge.start();

console.log('\n✅ Bridge Server con autenticación iniciado correctamente');