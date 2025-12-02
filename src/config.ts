/**
 * Configuration for the Minecraft proxy.
 */

export interface ProxyConfig {
  /** Port where the proxy listens for incoming Minecraft client connections */
  proxyPort: number;
  /** Hostname of the actual Minecraft server */
  minecraftHost: string;
  /** Port of the actual Minecraft server */
  minecraftPort: number;
  /** Whether to enable debug logging */
  debug: boolean;
}

/**
 * Default configuration.
 */
export const defaultConfig: ProxyConfig = {
  proxyPort: 25566,
  minecraftHost: 'localhost',
  minecraftPort: 25565,
  debug: false,
};

/**
 * Creates a configuration by merging user provided options with defaults.
 */
export function createConfig(overrides?: Partial<ProxyConfig>): ProxyConfig {
  return {
    ...defaultConfig,
    ...overrides,
  };
}
