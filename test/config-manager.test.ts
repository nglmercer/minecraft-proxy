import { describe, it, expect, afterEach, beforeAll } from 'bun:test';
import { loadConfig } from '../src/config-manager.js';
import { join } from 'path';
import { unlink } from 'node:fs/promises';

const TEST_CONFIG_FILE = 'test-config.yaml';
const TEST_CONFIG_PATH = join(process.cwd(), TEST_CONFIG_FILE);

const defaultConfig = {
    host: 'localhost',
    port: 8080,
    debug: false,
    tags: ['a', 'b']
};

describe('ConfigManager', () => {
    // Clean up before and after
    const cleanup = async () => {
        const file = Bun.file(TEST_CONFIG_PATH);
        if (await file.exists()) {
            await unlink(TEST_CONFIG_PATH);
        }
    };

    beforeAll(cleanup);
    afterEach(cleanup);

    it('should create a new config file with defaults if it does not exist', async () => {
        const config = await loadConfig(TEST_CONFIG_FILE, defaultConfig);

        expect(config).toEqual(defaultConfig);

        const file = Bun.file(TEST_CONFIG_PATH);
        expect(await file.exists()).toBe(true);

        const content = await file.text();
        expect(content).toContain('host: localhost');
        expect(content).toContain('port: 8080');
    });

    it('should load an existing config file', async () => {
        // First create it
        await loadConfig(TEST_CONFIG_FILE, defaultConfig);

        // Modify it
        const newConfig = { ...defaultConfig, port: 9090, debug: true };
        await Bun.write(TEST_CONFIG_PATH, Bun.YAML.stringify(newConfig));

        // Load it again
        const loaded = await loadConfig(TEST_CONFIG_FILE, defaultConfig);
        expect(loaded.port).toBe(9090);
        expect(loaded.debug).toBe(true);
        expect(loaded.host).toBe('localhost'); // Should keep unmodified
    });

    it('should merge defaults with existing config', async () => {
        // Create a partial config file
        const partialConfig = { port: 3000 };
        await Bun.write(TEST_CONFIG_PATH, Bun.YAML.stringify(partialConfig));

        const loaded = await loadConfig(TEST_CONFIG_FILE, defaultConfig);

        expect(loaded.port).toBe(3000);
        expect(loaded.host).toBe('localhost'); // From default
        expect(loaded.debug).toBe(false); // From default
    });
});
