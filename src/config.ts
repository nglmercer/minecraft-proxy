/**
 * Configuration for the Minecraft proxy.
 */

export interface ProxyConfig {
  /** Port to listen for incoming Minecraft connections */
  listenPort: number;
  /** Hostname of the backend Minecraft server */
  backendHost: string;
  /** Port of the backend Minecraft server */
  backendPort: number;
  /** Whether to enable debug logging */
  debug: boolean;
}

/**
 * Default configuration.
 */
export const defaultConfig: ProxyConfig = {
  listenPort: 25566,
  backendHost: 'localhost',
  backendPort: 25565,
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
