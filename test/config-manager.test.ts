import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { ConfigManager, ConfigError, loadConfig, type ConfigValidator } from '../src/config-manager.js';
import { join } from 'path';
import { unlink } from 'node:fs/promises';

// Test configuration types
interface TestConfig {
    host: string;
    port: number;
    debug: boolean;
    tags: string[];
    database?: {
        host: string;
        port: number;
    };
}

const defaultConfig: TestConfig = {
    host: 'localhost',
    port: 8080,
    debug: false,
    tags: ['a', 'b']
};

const defaultNestedConfig = {
    server: {
        host: 'localhost',
        port: 8080
    },
    logging: {
        level: 'info',
        verbose: false
    }
};

// Helper to cleanup test files
async function cleanupFile(fileName: string) {
    const path = join(process.cwd(), fileName);
    const file = Bun.file(path);
    if (await file.exists()) {
        await unlink(path);
    }
}

describe('ConfigManager - Legacy Function', () => {
    const TEST_FILE = 'test-legacy.yaml';

    afterEach(async () => {
        await cleanupFile(TEST_FILE);
    });

    it('should work with legacy loadConfig function', async () => {
        const config = await loadConfig(TEST_FILE, defaultConfig);
        expect(config).toEqual(defaultConfig);
        expect(await Bun.file(join(process.cwd(), TEST_FILE)).exists()).toBe(true);
    });

    it('should merge defaults with partial config', async () => {
        const partialConfig = { port: 3000 };
        await Bun.write(join(process.cwd(), TEST_FILE), Bun.YAML.stringify(partialConfig));

        const loaded = await loadConfig(TEST_FILE, defaultConfig);
        expect(loaded.port).toBe(3000);
        expect(loaded.host).toBe('localhost');
    });
});

describe('ConfigManager - Basic Operations', () => {
    const TEST_FILE = 'test-basic.yaml';

    afterEach(async () => {
        await cleanupFile(TEST_FILE);
    });

    it('should create config file with defaults on first load', async () => {
        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });
        const config = await manager.load();

        expect(config).toEqual(defaultConfig);
        expect(await Bun.file(join(process.cwd(), TEST_FILE)).exists()).toBe(true);
    });

    it('should load existing config file', async () => {
        const customConfig = { ...defaultConfig, port: 9090 };
        await Bun.write(join(process.cwd(), TEST_FILE), Bun.YAML.stringify(customConfig));

        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });
        const loaded = await manager.load();

        expect(loaded.port).toBe(9090);
    });

    it('should get current config', async () => {
        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });
        await manager.load();

        const config = manager.get();
        expect(config).toEqual(defaultConfig);
    });

    it('should get config values by key', async () => {
        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });
        await manager.load();

        expect(manager.getValue('port')).toBe(8080);
        expect(manager.getValue('host')).toBe('localhost');
        expect(manager.getValue('debug')).toBe(false);
    });

    it('should get nested config values by dot notation', async () => {
        const nestedConfig = {
            server: { host: 'localhost', port: 8080 },
            database: { host: 'db.local', port: 5432 }
        };
        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig: nestedConfig });
        await manager.load();

        expect(manager.getValue('server.host')).toBe('localhost');
        expect(manager.getValue('server.port')).toBe(8080);
        expect(manager.getValue('database.host')).toBe('db.local');
    });

    it('should return undefined for non-existent paths', async () => {
        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });
        await manager.load();

        expect(manager.getValue('nonexistent')).toBeUndefined();
        expect(manager.getValue('server.port')).toBeUndefined();
    });
});

describe('ConfigManager - Update and Save', () => {
    const TEST_FILE = 'test-update.yaml';

    afterEach(async () => {
        await cleanupFile(TEST_FILE);
    });

    it('should update and save config', async () => {
        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });
        await manager.load();

        await manager.update({ port: 9999 });

        expect(manager.get().port).toBe(9999);

        // Verify it was saved to file
        const content = await Bun.file(join(process.cwd(), TEST_FILE)).text();
        expect(content).toContain('port: 9999');
    });

    it('should update without saving when saveToFile is false', async () => {
        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });
        await manager.load();

        await manager.update({ port: 7777 }, false);

        expect(manager.get().port).toBe(7777);

        // File should still have old value
        const content = await Bun.file(join(process.cwd(), TEST_FILE)).text();
        expect(content).toContain('port: 8080');
    });

    it('should deep merge on update', async () => {
        const nestedConfig = {
            server: { host: 'localhost', port: 8080, ssl: false },
            database: { host: 'db.local', port: 5432 }
        };
        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig: nestedConfig });
        await manager.load();

        await manager.update({
            server: { port: 9090 }
        } as any);

        const config = manager.get();
        expect(config.server.port).toBe(9090);
        expect(config.server.host).toBe('localhost'); // Should be preserved
        expect(config.server.ssl).toBe(false); // Should be preserved
    });

    it('should save to custom path', async () => {
        const CUSTOM_FILE = 'test-custom-save.yaml';
        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });
        await manager.load();
        await manager.update({ port: 5555 });

        try {
            await manager.save(CUSTOM_FILE);

            const content = await Bun.file(join(process.cwd(), CUSTOM_FILE)).text();
            expect(content).toContain('port: 5555');
        } finally {
            await cleanupFile(CUSTOM_FILE);
        }
    });

    it('should reset to defaults', async () => {
        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });
        await manager.load();

        await manager.update({ port: 9999, debug: true });
        expect(manager.get().port).toBe(9999);

        await manager.reset();
        expect(manager.get()).toEqual(defaultConfig);

        // Verify file was updated
        const content = await Bun.file(join(process.cwd(), TEST_FILE)).text();
        expect(content).toContain('port: 8080');
    });

    it('should reset without saving when saveToFile is false', async () => {
        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });
        await manager.load();

        await manager.update({ port: 9999 });
        await manager.reset(false);

        expect(manager.get()).toEqual(defaultConfig);

        // File should still have updated value
        const content = await Bun.file(join(process.cwd(), TEST_FILE)).text();
        expect(content).toContain('port: 9999');
    });
});

describe('ConfigManager - Validation', () => {
    const TEST_FILE = 'test-validation.yaml';

    afterEach(async () => {
        await cleanupFile(TEST_FILE);
    });

    it('should pass custom validation', async () => {
        const validator: ConfigValidator<TestConfig> = (config) => {
            return config.port > 1024;
        };

        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig, validator });
        await manager.load();

        // Should not throw
        await manager.update({ port: 8080 });
    });

    it('should fail custom validation with boolean false', async () => {
        const validator: ConfigValidator<TestConfig> = (config) => {
            return config.port > 1024;
        };

        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig, validator });
        await manager.load();

        try {
            await manager.update({ port: 80 });
            throw new Error('Should have thrown validation error');
        } catch (error) {
            expect(error).toBeInstanceOf(ConfigError);
            expect((error as ConfigError).code).toBe('VALIDATION_ERROR');
        }
    });

    it('should fail custom validation with error message', async () => {
        const validator: ConfigValidator<TestConfig> = (config) => {
            if (config.port < 1024) {
                return 'Port must be >= 1024';
            }
            return true;
        };

        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig, validator });
        await manager.load();

        try {
            await manager.update({ port: 80 });
            throw new Error('Should have thrown validation error');
        } catch (error) {
            expect(error).toBeInstanceOf(ConfigError);
            expect((error as ConfigError).message).toContain('Port must be >= 1024');
        }
    });

    it('should support async validators', async () => {
        const validator: ConfigValidator<TestConfig> = async (config) => {
            // Simulate async validation (e.g., checking DNS)
            await new Promise(resolve => setTimeout(resolve, 10));
            return config.host !== 'blocked.com';
        };

        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig, validator });
        await manager.load();

        // Should pass
        await manager.update({ host: 'allowed.com' });

        // Should fail
        try {
            await manager.update({ host: 'blocked.com' });
            throw new Error('Should have thrown validation error');
        } catch (error) {
            expect(error).toBeInstanceOf(ConfigError);
        }
    });

    it('should validate type mismatches', async () => {
        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });
        await manager.load();

        try {
            await manager.update({ port: 'not a number' as any });
            throw new Error('Should have thrown validation error');
        } catch (error) {
            expect(error).toBeInstanceOf(ConfigError);
            expect((error as ConfigError).message).toContain('type');
        }
    });
});

describe('ConfigManager - Environment Overrides', () => {
    const TEST_FILE = 'test-env.yaml';
    const ENV_FILE = 'test-env.dev.yaml';

    afterEach(async () => {
        await cleanupFile(TEST_FILE);
        await cleanupFile(ENV_FILE);
    });

    it('should load environment-specific config', async () => {
        const envConfig = { port: 3000, debug: true };
        await Bun.write(join(process.cwd(), ENV_FILE), Bun.YAML.stringify(envConfig));

        const manager = new ConfigManager({
            fileName: TEST_FILE,
            defaultConfig,
            envFile: ENV_FILE
        });

        const config = await manager.load();
        expect(config.port).toBe(3000);
        expect(config.debug).toBe(true);
        expect(config.host).toBe('localhost'); // From defaults
    });

    it('should work when env file does not exist', async () => {
        const manager = new ConfigManager({
            fileName: TEST_FILE,
            defaultConfig,
            envFile: ENV_FILE
        });

        const config = await manager.load();
        expect(config).toEqual(defaultConfig);
    });

    it('should deep merge env overrides', async () => {
        const nestedConfig = {
            server: { host: 'localhost', port: 8080 },
            database: { host: 'db.local', port: 5432 }
        };
        const envOverride = {
            server: { port: 9090 }
        };

        await Bun.write(join(process.cwd(), ENV_FILE), Bun.YAML.stringify(envOverride));

        const manager = new ConfigManager({
            fileName: TEST_FILE,
            defaultConfig: nestedConfig,
            envFile: ENV_FILE
        });

        const config = await manager.load();
        expect(config.server.port).toBe(9090);
        expect(config.server.host).toBe('localhost'); // Preserved
        expect(config.database.host).toBe('db.local'); // Preserved
    });
});

describe('ConfigManager - File Watching', () => {
    const TEST_FILE = 'test-watch.yaml';

    afterEach(async () => {
        await cleanupFile(TEST_FILE);
    });

    it('should start and stop watching', async () => {
        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });
        await manager.load();

        manager.startWatching();
        expect(manager['watcher']).toBeDefined();

        manager.stopWatching();
        expect(manager['watcher']).toBeUndefined();
    });

    it('should call onChange when file changes', async () => {
        let changeCount = 0;
        let lastConfig: TestConfig | null = null;

        const manager = new ConfigManager<TestConfig>({
            fileName: TEST_FILE,
            defaultConfig,
            onChange: (config) => {
                changeCount++;
                lastConfig = config;
            }
        });

        await manager.load();
        manager.startWatching();

        try {
            // Give watch time to start
            await new Promise(resolve => setTimeout(resolve, 100));

            // Modify file
            const newConfig = { ...defaultConfig, port: 9999 };
            await Bun.write(join(process.cwd(), TEST_FILE), Bun.YAML.stringify(newConfig));

            // Wait for change detection
            await new Promise(resolve => setTimeout(resolve, 500));

            expect(changeCount).toBeGreaterThan(0);
            expect(lastConfig).not.toBeNull();
            expect(lastConfig!.port).toBe(9999);
        } finally {
            manager.stopWatching();
        }
    });

    it('should cleanup with close()', async () => {
        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });
        await manager.load();
        manager.startWatching();

        manager.close();
        expect(manager['watcher']).toBeUndefined();
    });
});

describe('ConfigManager - Silent Mode', () => {
    const TEST_FILE = 'test-silent.yaml';

    afterEach(async () => {
        await cleanupFile(TEST_FILE);
    });

    it('should suppress logs in silent mode', async () => {
        const manager = new ConfigManager({
            fileName: TEST_FILE,
            defaultConfig,
            silent: true
        });

        // Should not log anything
        await manager.load();
        await manager.update({ port: 9090 });
        await manager.save();

        expect(manager.get().port).toBe(9090);
    });
});

describe('ConfigManager - Error Handling', () => {
    const TEST_FILE = 'test-errors.yaml';

    afterEach(async () => {
        await cleanupFile(TEST_FILE);
    });

    it('should throw ConfigError for invalid YAML', async () => {
        await Bun.write(join(process.cwd(), TEST_FILE), 'invalid: yaml: [[[');

        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });

        try {
            await manager.load();
            throw new Error('Should have thrown ConfigError');
        } catch (error) {
            expect(error).toBeInstanceOf(ConfigError);
            expect((error as ConfigError).code).toBe('PARSE_ERROR');
            expect((error as ConfigError).path).toBeDefined();
        }
    });

    it('should throw ConfigError for non-object config', async () => {
        await Bun.write(join(process.cwd(), TEST_FILE), Bun.YAML.stringify(['array']));

        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });

        try {
            await manager.load();
            throw new Error('Should have thrown ConfigError');
        } catch (error) {
            expect(error).toBeInstanceOf(ConfigError);
            expect((error as ConfigError).code).toBe('INVALID_TYPE');
        }
    });

    it('should throw ConfigError for primitive config', async () => {
        await Bun.write(join(process.cwd(), TEST_FILE), 'just a string');

        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });

        try {
            await manager.load();
            throw new Error('Should have thrown ConfigError');
        } catch (error) {
            expect(error).toBeInstanceOf(ConfigError);
            expect((error as ConfigError).code).toBe('INVALID_TYPE');
        }
    });

    it('should include cause in ConfigError', async () => {
        await Bun.write(join(process.cwd(), TEST_FILE), 'invalid: : : yaml');

        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig });

        try {
            await manager.load();
        } catch (error) {
            expect(error).toBeInstanceOf(ConfigError);
            expect((error as ConfigError).cause).toBeDefined();
        }
    });
});

describe('ConfigManager - Edge Cases', () => {
    const TEST_FILE = 'test-edge.yaml';

    afterEach(async () => {
        await cleanupFile(TEST_FILE);
    });

    it('should handle null values', async () => {
        const configWithNull = {
            host: 'localhost',
            port: 8080,
            apiKey: null as string | null
        };

        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig: configWithNull });
        await manager.load();

        expect(manager.get().apiKey).toBeNull();
    });

    it('should replace arrays, not merge them', async () => {
        const configWithArrays = {
            tags: ['a', 'b', 'c'],
            features: ['auth']
        };

        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig: configWithArrays });
        await manager.load();

        await manager.update({ tags: ['x', 'y'] } as any);

        expect(manager.get().tags).toEqual(['x', 'y']);
        expect(manager.get().tags.length).toBe(2);
    });

    it('should handle deeply nested objects', async () => {
        const deepConfig = {
            level1: {
                level2: {
                    level3: {
                        level4: {
                            value: 'deep'
                        }
                    }
                }
            }
        };

        const manager = new ConfigManager({ fileName: TEST_FILE, defaultConfig: deepConfig });
        await manager.load();

        expect(manager.getValue('level1.level2.level3.level4.value')).toBe('deep');

        await manager.update({
            level1: {
                level2: {
                    level3: {
                        level4: {
                            value: 'updated'
                        }
                    }
                }
            }
        } as any);

        expect(manager.getValue('level1.level2.level3.level4.value')).toBe('updated');
    });

    it('should format YAML with custom spacing', async () => {
        const manager = new ConfigManager({
            fileName: TEST_FILE,
            defaultConfig,
            spaces: 4
        });
        await manager.load();

        const content = await Bun.file(join(process.cwd(), TEST_FILE)).text();
        // With 4 spaces, nested items should have 4-space indentation
        expect(content).toContain('    ');
    });

    it('should handle absolute file paths', async () => {
        const absolutePath = join(process.cwd(), 'test-absolute.yaml');

        try {
            const manager = new ConfigManager({
                fileName: absolutePath,
                defaultConfig
            });
            await manager.load();

            expect(await Bun.file(absolutePath).exists()).toBe(true);
        } finally {
            await cleanupFile('test-absolute.yaml');
        }
    });
});
