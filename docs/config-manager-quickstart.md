# ConfigManager Quick Start

## Basic Usage

```typescript
import { ConfigManager } from './src/config-manager.js';

// Define your config type
interface MyConfig {
    host: string;
    port: number;
    debug: boolean;
}

// Set defaults
const defaultConfig: MyConfig = {
    host: 'localhost',
    port: 8080,
    debug: false
};

// Create manager
const manager = new ConfigManager({
    fileName: 'config.yaml',
    defaultConfig
});

// Load config (creates file with defaults if it doesn't exist)
const config = await manager.load();

// Get current config
console.log(manager.get());

// Get specific value
console.log(manager.getValue('port')); // 8080

// Update config (saves to file)
await manager.update({ port: 9090 });

// Reset to defaults
await manager.reset();
```

## With Validation

```typescript
const manager = new ConfigManager({
    fileName: 'config.yaml',
    defaultConfig,
    validator: (config) => {
        if (config.port < 1024) {
            return 'Port must be >= 1024';
        }
        return true;
    }
});
```

## With Environment Overrides

```typescript
// config.yaml (base)
// config.dev.yaml (dev overrides)
// config.prod.yaml (prod overrides)

const env = process.env.NODE_ENV || 'development';
const manager = new ConfigManager({
    fileName: 'config.yaml',
    envFile: `config.${env}.yaml`,
    defaultConfig
});
```

## With File Watching

```typescript
const manager = new ConfigManager({
    fileName: 'config.yaml',
    defaultConfig,
    onChange: (newConfig) => {
        console.log('Config reloaded:', newConfig);
    }
});

await manager.load();
manager.startWatching();
```

## Error Handling

```typescript
try {
    await manager.load();
} catch (error) {
    if (error instanceof ConfigError) {
        console.error(`${error.code}: ${error.message}`);
        if (error.path) console.error(`File: ${error.path}`);
        if (error.cause) console.error(`Cause:`, error.cause);
    }
}
```

## Silent Mode

```typescript
const manager = new ConfigManager({
    fileName: 'config.yaml',
    defaultConfig,
    silent: true // No console output
});
```

## Legacy API (Still Supported)

```typescript
import { loadConfig } from './src/config-manager.js';

const config = await loadConfig('config.yaml', defaultConfig);
```
