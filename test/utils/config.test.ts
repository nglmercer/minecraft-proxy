import { describe, expect, test } from 'bun:test';
import { defaultConfig, createConfig, type ProxyConfig } from '../../src/config/config.js';

describe('Config', () => {
  test('defaultConfig has correct values', () => {
    expect(defaultConfig.proxyPort).toBe(25566);
    expect(defaultConfig.minecraftHost).toBe('localhost');
    expect(defaultConfig.minecraftPort).toBe(25565);
    expect(defaultConfig.debug).toBe(false);
  });

  test('createConfig returns default config when no overrides', () => {
    const config = createConfig();
    expect(config).toEqual(defaultConfig);
  });

  test('createConfig merges overrides correctly', () => {
    const overrides: Partial<ProxyConfig> = {
      proxyPort: 3000,
      minecraftHost: 'example.com',
      debug: true,
    };
    const config = createConfig(overrides);
    expect(config.proxyPort).toBe(3000);
    expect(config.minecraftHost).toBe('example.com');
    expect(config.minecraftPort).toBe(25565); // default
    expect(config.debug).toBe(true);
  });

  test('createConfig handles empty overrides object', () => {
    const config = createConfig({});
    expect(config).toEqual(defaultConfig);
  });

  test('createConfig can override all properties', () => {
    const overrides: ProxyConfig = {
      proxyPort: 4000,
      minecraftHost: 'test.com',
      minecraftPort: 4001,
      transportType: 'tcp',
      debug: true,
    };
    const config = createConfig(overrides);
    expect(config).toEqual(overrides);
  });
});
