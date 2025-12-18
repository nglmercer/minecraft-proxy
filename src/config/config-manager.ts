import { join } from 'path';
import { watch, type FSWatcher } from 'fs';

/**
 * Configuration error with context
 */
export class ConfigError extends Error {
    constructor(
        message: string,
        public readonly code: 'PARSE_ERROR' | 'VALIDATION_ERROR' | 'IO_ERROR' | 'INVALID_TYPE',
        public readonly path?: string,
        public override readonly cause?: Error
    ) {
        super(message);
        this.name = 'ConfigError';
    }
}

/**
 * Validation function type
 */
export type ConfigValidator<T> = (config: T) => boolean | string | Promise<boolean | string>;

/**
 * Configuration manager options
 */
export interface ConfigManagerOptions<T extends object> {
    /** File name (relative to cwd) or absolute path */
    fileName: string;
    /** Default configuration */
    defaultConfig: T;
    /** Custom validator function */
    validator?: ConfigValidator<T>;
    /** Watch for file changes */
    watch?: boolean;
    /** Callback when config changes (only if watch is true) */
    onChange?: (config: T) => void;
    /** Environment-specific config override file (e.g., 'config.dev.yaml') */
    envFile?: string;
    /** Number of spaces for YAML formatting (default: 2) */
    spaces?: number;
    /** Silent mode - suppress console logs */
    silent?: boolean;
}

/**
 * Deep merges two objects.
 * Sources overwrite target. Arrays are replaced, not merged.
 */
function deepMerge(target: any, source: any): any {
    if (typeof target !== 'object' || target === null || typeof source !== 'object' || source === null) {
        return source;
    }

    if (Array.isArray(source)) {
        return source; // Arrays are replaced
    }

    const output = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object && key in target && target[key] instanceof Object && !Array.isArray(source[key])) {
            output[key] = deepMerge(target[key], source[key]);
        } else {
            output[key] = source[key];
        }
    }
    return output;
}

/**
 * Validates the config against the default config types.
 */
function validateConfigTypes(config: any, defaults: any, path = ''): string[] {
    const errors: string[] = [];

    if (typeof defaults !== 'object' || defaults === null) return errors;

    for (const key of Object.keys(defaults)) {
        if (!(key in config)) continue;

        const defaultVal = defaults[key];
        const configVal = config[key];
        const currentPath = path ? `${path}.${key}` : key;

        if (defaultVal === null || configVal === null) continue; // Skip null checks

        if (typeof defaultVal !== typeof configVal) {
            errors.push(`Expected type ${typeof defaultVal} for '${currentPath}', got ${typeof configVal}`);
        } else if (typeof defaultVal === 'object' && !Array.isArray(defaultVal)) {
            errors.push(...validateConfigTypes(configVal, defaultVal, currentPath));
        }
    }

    return errors;
}

/**
 * Configuration Manager Class
 * Provides advanced configuration management with watching, validation, and environment overrides
 */
export class ConfigManager<T extends object> {
    private config: T;
    private readonly defaultConfig: T;
    private readonly configPath: string;
    private readonly envPath?: string;
    private readonly validator?: ConfigValidator<T>;
    private readonly onChange?: (config: T) => void;
    private readonly spaces: number;
    private readonly silent: boolean;
    private watcher?: FSWatcher;

    constructor(options: ConfigManagerOptions<T>) {
        this.defaultConfig = options.defaultConfig;
        this.configPath = options.fileName.startsWith('/') || options.fileName.match(/^[a-zA-Z]:/)
            ? options.fileName
            : join(process.cwd(), options.fileName);
        this.envPath = options.envFile
            ? (options.envFile.startsWith('/') || options.envFile.match(/^[a-zA-Z]:/)
                ? options.envFile
                : join(process.cwd(), options.envFile))
            : undefined;
        this.validator = options.validator;
        this.onChange = options.onChange;
        this.spaces = options.spaces ?? 2;
        this.silent = options.silent ?? false;
        this.config = { ...this.defaultConfig };
    }

    /**
     * Initialize and load configuration
     */
    async load(): Promise<T> {
        try {
            // Load base config
            this.config = await this.loadFromFile(this.configPath, true);

            // Load environment-specific overrides if specified
            if (this.envPath) {
                const envFile = Bun.file(this.envPath);
                if (await envFile.exists()) {
                    const envConfig = await this.loadFromFile(this.envPath, false);
                    this.config = deepMerge(this.config, envConfig);
                    if (!this.silent) {
                        console.log(`Applied environment config from ${this.envPath}`);
                    }
                }
            }

            // Run custom validation if provided
            if (this.validator) {
                const result = await this.validator(this.config);
                if (typeof result === 'string') {
                    throw new ConfigError(
                        `Custom validation failed: ${result}`,
                        'VALIDATION_ERROR',
                        this.configPath
                    );
                }
                if (result === false) {
                    throw new ConfigError(
                        'Custom validation failed',
                        'VALIDATION_ERROR',
                        this.configPath
                    );
                }
            }

            return this.config;
        } catch (error) {
            if (error instanceof ConfigError) throw error;
            throw new ConfigError(
                'Failed to load configuration',
                'IO_ERROR',
                this.configPath,
                error as Error
            );
        }
    }

    /**
     * Load configuration from a file
     */
    private async loadFromFile(path: string, createIfMissing: boolean): Promise<T> {
        const configFile = Bun.file(path);

        if (!(await configFile.exists())) {
            if (createIfMissing) {
                if (!this.silent) {
                    console.log(`Creating default configuration: ${path}`);
                }
                const yamlContent = YAML.stringify(this.defaultConfig, null, this.spaces);
                await Bun.write(path, yamlContent);
                return { ...this.defaultConfig };
            } else {
                return {} as T; // Return empty object for optional env files
            }
        }

        if (!this.silent) {
            console.log(`Loading configuration from ${path}`);
        }

        const content = await configFile.text();
        
        // Handle empty or whitespace-only files
        if (!content || content.trim().length === 0) {
            if (!this.silent) {
                console.warn(`Config file is empty, using defaults`);
            }
            return { ...this.defaultConfig };
        }
        
        try {
            const parsed = YAML.parse(content);

            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                throw new ConfigError(
                    `Config file is invalid (not an object)`,
                    'INVALID_TYPE',
                    path
                );
            }

            const merged = deepMerge(this.defaultConfig, parsed);

            // Validate types
            const typeErrors = validateConfigTypes(merged, this.defaultConfig);
            if (typeErrors.length > 0 && !this.silent) {
                typeErrors.forEach(err => console.warn(`Config warning: ${err}`));
            }

            return merged as T;
        } catch (error) {
            if (error instanceof ConfigError) throw error;
            throw new ConfigError(
                `Failed to parse YAML`,
                'PARSE_ERROR',
                path,
                error as Error
            );
        }
    }

    /**
     * Get current configuration
     */
    get(): T {
        return { ...this.config };
    }

    /**
     * Get a specific config value by path (e.g., 'server.port')
     * Supports both top-level keys and dot notation for nested values
     */
    getValue(path: string): any {
        const keys = path.split('.');
        let value: any = this.config;
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }
        return value;
    }

    /**
     * Update configuration (in memory and optionally save to file)
     */
    async update(updates: Partial<T>, saveToFile = true): Promise<T> {
        const newConfig = deepMerge(this.config, updates) as T;

        // Validate types
        const typeErrors = validateConfigTypes(newConfig, this.defaultConfig);
        if (typeErrors.length > 0) {
            throw new ConfigError(
                `Type validation failed: ${typeErrors.join(', ')}`,
                'VALIDATION_ERROR'
            );
        }

        // Run custom validation if provided
        if (this.validator) {
            const result = await this.validator(newConfig);
            if (typeof result === 'string') {
                throw new ConfigError(
                    `Custom validation failed: ${result}`,
                    'VALIDATION_ERROR'
                );
            }
            if (result === false) {
                throw new ConfigError('Custom validation failed', 'VALIDATION_ERROR');
            }
        }

        this.config = newConfig;

        if (saveToFile) {
            await this.save();
        }

        return this.config;
    }

    /**
     * Save current configuration to file
     */
    async save(path?: string): Promise<void> {
        const targetPath = path ?? this.configPath;
        try {
            const yamlContent = YAML.stringify(this.config, null, this.spaces);
            await Bun.write(targetPath, yamlContent);
            if (!this.silent) {
                console.log(`Configuration saved to ${targetPath}`);
            }
        } catch (error) {
            throw new ConfigError(
                'Failed to save configuration',
                'IO_ERROR',
                targetPath,
                error as Error
            );
        }
    }

    /**
     * Start watching for file changes
     */
    startWatching(): void {
        if (this.watcher) {
            if (!this.silent) {
                console.warn('Already watching configuration file');
            }
            return;
        }

        this.watcher = watch(this.configPath, async (eventType) => {
            if (eventType === 'change') {
                try {
                    if (!this.silent) {
                        console.log('Configuration file changed, reloading...');
                    }
                    
                    // Add a small delay to ensure file write is complete
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    await this.load();
                    if (this.onChange) {
                        this.onChange(this.config);
                    }
                } catch (error) {
                    console.error('Failed to reload configuration:', error);
                }
            }
        });

        if (!this.silent) {
            console.log(`Watching configuration file: ${this.configPath}`);
        }
    }

    /**
     * Stop watching for file changes
     */
    stopWatching(): void {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = undefined;
            if (!this.silent) {
                console.log('Stopped watching configuration file');
            }
        }
    }

    /**
     * Reset configuration to defaults
     */
    async reset(saveToFile = true): Promise<T> {
        this.config = { ...this.defaultConfig };
        if (saveToFile) {
            await this.save();
        }
        return this.config;
    }

    /**
     * Close and cleanup
     */
    close(): void {
        this.stopWatching();
    }
}

/**
 * Helper object for YAML operations (mirrors Bun.YAML)
 */
const YAML = {
    parse: (content: string) => Bun.YAML.parse(content),
    stringify: (obj: any, replacer?: null, space?: string | number) => {
        if (typeof space === 'number') {
            return Bun.YAML.stringify(obj, null, space);
        }
        return Bun.YAML.stringify(obj);
    }
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use ConfigManager class instead
 */
export async function loadConfig<T extends object>(fileName: string, defaultConfig: T): Promise<T> {
    const manager = new ConfigManager({ fileName, defaultConfig, silent: false });
    return await manager.load();
}
