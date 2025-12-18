# 🔧 Guía de Compilación de Ejemplos

Esta guía muestra cómo compilar correctamente los ejemplos del proyecto Minecraft TCP Server.

## 📋 Requisitos Previos

- Bun instalado en el sistema
- Node.js 18+ (para algunas dependencias de crypto)

## 🚀 Compilación de Ejemplos

### Método 1: Compilar Individualmente

```bash
# Compilar un ejemplo específico
bun build examples/bridge/basic-bridge.ts --outdir=dist-examples --target=node

# Compilar con diferentes opciones
bun build examples/bridge/bridge-with-auth.ts --outdir=dist-examples --target=node --minify
```

### Método 2: Compilar Todos los Ejemplos

```bash
# Crear script para compilar todos los ejemplos
#!/bin/bash
echo "📦 Compilando todos los ejemplos..."

# Bridge examples
bun build examples/bridge/basic-bridge.ts --outdir=dist-examples/bridge --target=node
bun build examples/bridge/bridge-with-auth.ts --outdir=dist-examples/bridge --target=node
bun build examples/bridge/multi-bridge-standalone.ts --outdir=dist-examples/bridge --target=node
bun build examples/bridge/basic-agent.ts --outdir=dist-examples/bridge --target=node
bun build examples/bridge/agent-with-token-auth.ts --outdir=dist-examples/bridge --target=node

# Proxy examples
bun build examples/proxy/basic-proxy.ts --outdir=dist-examples/proxy --target=node
bun build examples/proxy/multi-proxy-network.ts --outdir=dist-examples/proxy --target=node

# Auth examples
bun build examples/auth/token-manager-demo.ts --outdir=dist-examples/auth --target=node

# Complete setup
bun build examples/complete-setup.ts --outdir=dist-examples --target=node

echo "✅ Todos los ejemplos compilados exitosamente!"
```

### Método 3: Usar el Build del Proyecto

```bash
# Compilar todo el proyecto (incluye ejemplos si están en tsconfig)
bun run build

# Esto ejecuta: bunx tsc -p tsconfig.build.json
```

## 🎯 Targets de Compilación

### Node.js Target (`--target=node`)
- ✅ Uso completo de módulos de Node.js
- ✅ Acceso a `node:crypto` con `timingSafeEqual`
- ✅ Recomendado para ejemplos de servidor

### Bun Target (`--target=bun`)
- ✅ Optimizado para Bun runtime
- ✅ Acceso a APIs específicas de Bun
- ✅ Mejor rendimiento en Bun

### Browser Target (por defecto)
- ❌ No compatible con `node:crypto`
- ❌ No tiene `timingSafeEqual`
- ⚠️ No recomendado para estos ejemplos

## 🔧 Opciones de Compilación

```bash
# Compilar con minificación
bun build examples/bridge/basic-bridge.ts --outdir=dist-examples --target=node --minify

# Compilar con source maps
bun build examples/bridge/basic-bridge.ts --outdir=dist-examples --target=node --sourcemap

# Compilar con nombre personalizado
bun build examples/bridge/basic-bridge.ts --outdir=dist-examples --target=node --naming=[dir]/[name]/[ext]

# Compilar con entrada múltiple
bun build examples/bridge/*.ts examples/proxy/*.ts --outdir=dist-examples --target=node
```

## 📁 Estructura de Salida

```
dist-examples/
├── bridge/
│   ├── basic-bridge.js
│   ├── bridge-with-auth.js
│   ├── multi-bridge-standalone.js
│   ├── basic-agent.js
│   └── agent-with-token-auth.js
├── proxy/
│   ├── basic-proxy.js
│   └── multi-proxy-network.js
├── auth/
│   └── token-manager-demo.js
└── complete-setup.js
```

## 🚀 Ejecutar Ejemplos Compilados

```bash
# Ejecutar un ejemplo compilado
bun run dist-examples/bridge/basic-bridge.js

# O con Node.js
node dist-examples/bridge/basic-bridge.js
```

## 🐛 Solución de Problemas

### Error: "timingSafeEqual is not available in browser builds"
```bash
# ❌ Incorrecto
bun build examples/bridge/basic-bridge.ts --outdir=dist-examples

# ✅ Correcto
bun build examples/bridge/basic-bridge.ts --outdir=dist-examples --target=node
```

### Error: "Cannot find module 'node:crypto'"
```bash
# Asegúrate de usar --target=node
bun build examples/bridge/basic-bridge.ts --outdir=dist-examples --target=node
```

### Error: "Module not found"
```bash
# Verifica que el proyecto esté construido primero
bun run build

# Luego compila los ejemplos
bun build examples/bridge/basic-bridge.ts --outdir=dist-examples --target=node
```

## 📊 Comparación de Métodos

| Método | Velocidad | Tamaño | Node APIs | Recomendado |
|--------|-----------|--------|-----------|-------------|
| `bun build --target=node` | ⚡ Rápido | 📦 Grande | ✅ Completo | ✅ Sí |
| `bun build --target=bun` | ⚡⚡ Muy rápido | 📦 Mediano | ✅ Completo | ✅ Sí |
| `bun build` (browser) | ⚡ Rápido | 📦 Pequeño | ❌ Limitado | ❌ No |
| `tsc` | 🐌 Lento | 📄 Grande | ✅ Completo | ✅ Sí |

## 💡 Mejores Prácticas

1. **Siempre usa `--target=node`** para ejemplos de servidor
2. **Compila después de cambios** en los archivos fuente
3. **Usa `--minify`** para producción
4. **Mantén los imports relativos** correctos
5. **Verifica que el proyecto principal compile** antes de los ejemplos

## 📝 Notas Importantes

- Los ejemplos usan `node:crypto` que requiere Node.js target
- El TokenManager usa APIs criptográficas que no están disponibles en browser
- Los ejemplos de Bridge/Agent son para servidor, no cliente
- Siempre especifica el target correcto para evitar errores

---

**¡Listo para compilar y ejecutar tus ejemplos!** 🚀