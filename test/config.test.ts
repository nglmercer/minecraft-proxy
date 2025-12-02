import { describe, expect, test } from 'bun:test';
import { defaultConfig, createConfig, type ProxyConfig } from '../src/config.js';

describe('Config', () => {
  test('defaultConfig has correct values', () => {
    expect(defaultConfig.listenPort).toBe(25565);
    expect(defaultConfig.backendHost).toBe('localhost');
    expect(defaultConfig.backendPort).toBe(25566);
    expect(defaultConfig.debug).toBe(false);
  });

  test('createConfig returns default config when no overrides', () => {
    const config = createConfig();
    expect(config).toEqual(defaultConfig);
  });

  test('createConfig merges overrides correctly', () => {
    const overrides: Partial<ProxyConfig> = {
      listenPort: 3000,
      backendHost: 'example.com',
      debug: true,
    };
    const config = createConfig(overrides);
    expect(config.listenPort).toBe(3000);
    expect(config.backendHost).toBe('example.com');
    expect(config.backendPort).toBe(25566); // default
    expect(config.debug).toBe(true);
  });

  test('createConfig handles empty overrides object', () => {
    const config = createConfig({});
    expect(config).toEqual(defaultConfig);
  });

  test('createConfig can override all properties', () => {
    const overrides: ProxyConfig = {
      listenPort: 4000,
      backendHost: 'test.com',
      backendPort: 4001,
      debug: true,
    };
    const config = createConfig(overrides);
    expect(config).toEqual(overrides);
  });
});
