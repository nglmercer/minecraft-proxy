import { TokenManager } from '../../src/index.js';

// Demo del sistema de gestión de tokens
console.log('🔐 Demo del Sistema de Gestión de Tokens');
console.log('==========================================\n');

// Configuración del TokenManager
const tokenManager = new TokenManager({
    secret: 'master-secret-key',
    tokenExpiryHours: 24,
    codeExpiryMinutes: 30,
    maxTokensPerAgent: 3
});

console.log('🎯 Configuración inicial:');
console.log('   - Secreto maestro: master-secret-key');
console.log('   - Expiración de tokens: 24 horas');
console.log('   - Expiración de códigos: 30 minutos');
console.log('   - Máximo de tokens por agente: 3\n');

// 1. Generar códigos de reclamo
console.log('🎫 Generando códigos de reclamo...');

const agents = [
    { agentId: 'survival-server-01', namespace: 'survival' },
    { agentId: 'creative-server-01', namespace: 'creative' },
    { agentId: 'minigames-server-01', namespace: 'minigames' },
    { agentId: 'hub-server-01', namespace: 'hub' }
];

const claimCodes: string[] = [];

agents.forEach(agent => {
    const code = tokenManager.generateClaimCode(agent.agentId, agent.namespace);
    if (code) {
        claimCodes.push(code);
        console.log(`   ✓ ${agent.agentId}: ${code}`);
    }
});

console.log('\n📊 Estadísticas después de generar códigos:');
const stats1 = tokenManager.getStats();
console.log(stats1);

// 2. Canjear algunos códigos
console.log('\n🔄 Canjeando códigos de reclamo...');

// Canjear los primeros 2 códigos
for (let i = 0; i < 2 && i < claimCodes.length; i++) {
    const code = claimCodes[i];
    if (!code) continue;
    const token = tokenManager.redeemClaimCode(code);
    
    if (token) {
        console.log(`   ✓ Código ${code} canjeado exitosamente`);
        console.log(`     - Token: ${token.token.substring(0, 20)}...`);
        console.log(`     - Agente: ${token.agentId}`);
        console.log(`     - Namespace: ${token.namespace}`);
    } else {
        console.log(`   ❌ Código ${code} inválido o expirado`);
    }
}

console.log('\n📊 Estadísticas después de canjear códigos:');
const stats2 = tokenManager.getStats();
console.log(stats2);

// 3. Validar tokens
console.log('\n🔍 Validando tokens...');

// Obtener tokens activos
const activeTokens = tokenManager.getAgentTokens('survival-server-01');
if (activeTokens.length > 0 && activeTokens[0]) {
    const testToken = activeTokens[0].token;
    const isValid = tokenManager.validateToken(testToken);
    
    console.log(`   ✓ Token válido: ${isValid ? 'SÍ' : 'NO'}`);
    console.log(`   - Token: ${testToken.substring(0, 20)}...`);
    console.log(`   - Agente: ${activeTokens[0].agentId}`);
    console.log(`   - Namespace: ${activeTokens[0].namespace}`);
    console.log(`   - Expira: ${activeTokens[0].expiresAt}`);
}

// 4. Probar límite de tokens por agente
console.log('\n🧪 Probando límite de tokens por agente...');

const testAgentId = 'test-agent-limit';
const testNamespace = 'test';

// Generar más tokens que el límite permitido
for (let i = 0; i < 5; i++) {
    const code = tokenManager.generateClaimCode(testAgentId, testNamespace);
    const token = tokenManager.redeemClaimCode(code);
    
    if (token) {
        console.log(`   ✓ Token ${i + 1} generado: ${token.token.substring(0, 20)}...`);
    }
}

console.log(`\n📊 Tokens activos para ${testAgentId}:`);
const testAgentTokens = tokenManager.getAgentTokens(testAgentId);
console.log(`   - Total: ${testAgentTokens.length}`);
testAgentTokens.forEach((token, index) => {
    console.log(`   - Token ${index + 1}: ${token.token.substring(0, 20)}...`);
});

// 5. Revocar tokens
console.log('\n🔒 Revocando tokens...');

if (testAgentTokens.length > 0 && testAgentTokens[0]) {
    const tokenToRevoke = testAgentTokens[0].token;
    const revoked = tokenManager.revokeToken(tokenToRevoke);
    
    console.log(`   ✓ Token revocado: ${revoked ? 'SÍ' : 'NO'}`);
    console.log(`   - Token: ${tokenToRevoke.substring(0, 20)}...`);
}

// Revocar todos los tokens de un agente
const allRevoked = tokenManager.revokeAllTokens(testAgentId);
console.log(`   ✓ Tokens totales revocados para ${testAgentId}: ${allRevoked}`);

console.log(`\n📊 Tokens restantes para ${testAgentId}:`);
const remainingTokens = tokenManager.getAgentTokens(testAgentId);
console.log(`   - Total: ${remainingTokens.length}`);

// 6. Estadísticas finales
console.log('\n📈 Estadísticas finales:');
const finalStats = tokenManager.getStats();
console.log(finalStats);

// 7. Demostrar comparación segura de tokens
console.log('\n🔐 Demostración de comparación segura de tokens:');

const { TokenManager: TokenManagerClass } = await import('../../src/index.js');
const token1 = 'test-token-123';
const token2 = 'test-token-123';
const token3 = 'test-token-456';

console.log(`   - Token 1 == Token 2: ${TokenManagerClass.secureCompare(token1, token2)}`);
console.log(`   - Token 1 == Token 3: ${TokenManagerClass.secureCompare(token1, token3)}`);

console.log('\n✅ Demo completada exitosamente');
console.log('\n💡 Resumen de funcionalidades:');
console.log('   - Generación de códigos de reclamo seguros');
console.log('   - Canje de códigos por tokens');
console.log('   - Validación de tokens con expiración');
console.log('   - Límites de tokens por agente');
console.log('   - Revocación individual y masiva de tokens');
console.log('   - Comparación segura de tokens (timing attack resistant)');