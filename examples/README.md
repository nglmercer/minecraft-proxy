# 🚀 Ejemplos de Minecraft TCP Server

Esta carpeta contiene ejemplos organizados por categorías para demostrar las capacidades del sistema de túneles y proxies de Minecraft.

## 📁 Estructura de Ejemplos

```
examples/
├── bridge/           # Ejemplos de Bridge Server (VPS)
├── proxy/            # Ejemplos de Proxy Server
├── auth/             # Ejemplos de autenticación y tokens
├── complete-setup.ts # Configuración completa del sistema
└── README.md         # Este archivo
```

## 🌉 Bridge Examples (`bridge/`)

### Servidores Bridge (VPS en la nube)

| Archivo | Descripción | Complejidad |
|---------|-------------|-------------|
| [`basic-bridge.ts`](bridge/basic-bridge.ts) | Bridge básico sin autenticación | ⭐ |
| [`bridge-with-auth.ts`](bridge/bridge-with-auth.ts) | Bridge con autenticación por tokens | ⭐⭐ |
| [`multi-bridge-standalone.ts`](bridge/multi-bridge-standalone.ts) | Múltiples bridges independientes | ⭐⭐⭐ |

### Agentes Tunnel (Servidores en casa)

| Archivo | Descripción | Complejidad |
|---------|-------------|-------------|
| [`basic-agent.ts`](bridge/basic-agent.ts) | Agente básico con secreto compartido | ⭐ |
| [`agent-with-token-auth.ts`](bridge/agent-with-token-auth.ts) | Agente con autenticación avanzada | ⭐⭐ |

## 🔄 Proxy Examples (`proxy/`)

| Archivo | Descripción | Complejidad |
|---------|-------------|-------------|
| [`basic-proxy.ts`](proxy/basic-proxy.ts) | Proxy simple de redirección | ⭐ |
| [`multi-proxy-network.ts`](proxy/multi-proxy-network.ts) | Red de proxies para múltiples servidores | ⭐⭐⭐ |

## 🔐 Authentication Examples (`auth/`)

| Archivo | Descripción | Complejidad |
|---------|-------------|-------------|
| [`token-manager-demo.ts`](auth/token-manager-demo.ts) | Demo completa del sistema de tokens | ⭐⭐⭐ |

## 🎯 Ejemplo Completo

| Archivo | Descripción | Complejidad |
|---------|-------------|-------------|
| [`complete-setup.ts`](complete-setup.ts) | Sistema completo integrado | ⭐⭐⭐⭐ |

## 🚀 Guía Rápida

### 1. Bridge Básico (Sin Autenticación)
```bash
# Terminal 1: Bridge Server
bun run examples/bridge/basic-bridge.ts

# Terminal 2: Tunnel Agent
bun run examples/bridge/basic-agent.ts

# Los jugadores se conectan a: localhost:8080
```

### 2. Bridge con Autenticación
```bash
# Terminal 1: Bridge con autenticación
bun run examples/bridge/bridge-with-auth.ts

# Terminal 2: Agent con código de reclamo
bun run examples/bridge/agent-with-token-auth.ts

# Los jugadores usan subdominios: sv.minecraft-tunnel.example.com:8080
```

### 3. Sistema Completo
```bash
# Todo en uno: Bridge + Agent + Proxy + Autenticación
bun run examples/complete-setup.ts
```

## 🔧 Flujo de Trabajo Típico

### Escenario 1: VPS + Casa (Túnel Inverso)
```
[Jugador] → [Bridge VPS:8080] → [Agent Casa] → [Minecraft Server:25565]
```

### Escenario 2: Red de Proxies Local
```
[Jugador] → [Proxy:25566] → [Minecraft Server:25565]
```

### Escenario 3: Sistema Completo
```
[Jugador] → [Bridge VPS:8080] → [Agent Casa] → [Proxy Local:25566] → [Minecraft:25565]
```

## 🎮 Conexión de Jugadores

### Sin Autenticación
```bash
# Jugador se conecta directamente
minecraft.exe sv.minecraft-tunnel.example.com:8080
```

### Con Autenticación
```bash
# 1. Admin genera código: ABC123
# 2. Agente usa código para conectarse
# 3. Jugador se conecta al subdominio asignado
minecraft.exe sv.minecraft-tunnel.example.com:8080
```

## 🔑 Sistema de Autenticación

### Códigos de Reclamo (Claim Codes)
- Códigos de 6 caracteres (ABC123)
- Válidos por 30 minutos
- Un solo uso
- Generados por el Bridge

### Tokens
- UUID largos y seguros
- Válidos por 24 horas (configurable)
- Reutilizables
- Se obtienen al canjear códigos

### Flujo de Autenticación
1. **Admin** genera código en Bridge
2. **Agente** canjea código por token
3. **Agente** usa token para autenticación
4. **Bridge** valida token y permite conexión

## 📊 Monitoreo y Estadísticas

Todos los ejemplos incluyen:
- ✅ Logs detallados con `debug: true`
- ✅ Estadísticas de conexiones
- ✅ Gestión de errores
- ✅ Cierre graceful (SIGINT/SIGTERM)

## 🛡️ Seguridad

- **Timing Attack Protection**: Comparación segura de tokens
- **Rate Limiting**: Límite de intentos de autenticación
- **Token Expiry**: Tokens y códigos con expiración
- **Secure Random**: Generación criptográfica de tokens

## 🚨 Solución de Problemas

### Error: "Agent authentication failed"
- Verificar que el código/token sea válido
- Comprobar que no haya expirado
- Asegurar que el agente no esté ya conectado

### Error: "Bridge connection refused"
- Verificar que el Bridge esté ejecutándose
- Comprobar el puerto y firewall
- Validar la dirección IP del Bridge

### Error: "Minecraft server not found"
- Asegurar que el servidor Minecraft esté ejecutándose
- Verificar el puerto correcto
- Comprobar la conexión local

## 📚 Próximos Pasos

1. **Personalizar**: Adaptar los ejemplos a tu infraestructura
2. **Escalar**: Usar múltiples bridges y agentes
3. **Automatizar**: Generar códigos dinámicamente
4. **Monitorear**: Implementar métricas y alertas
5. **Segurizar**: Añadir SSL/TLS y más capas de seguridad

## 💡 Tips

- ✅ Empieza con el ejemplo básico
- ✅ Usa `debug: true` durante desarrollo
- ✅ Prueba en local antes de producción
- ✅ Genera códigos únicos por agente
- ✅ Monitorea los logs regularmente
- ✅ Implementa respaldos de configuración

## 🆘 Soporte

Para problemas o preguntas:
1. Revisa los logs de error
2. Consulta la documentación en `/docs`
3. Verifica los ejemplos en esta carpeta
4. Reporta issues en el repositorio

---

**¡Disfruta de tu sistema de túneles Minecraft!** 🎮✨