import { join } from 'path';

/**
 * Loads configuration from a YAML file.
 * If the file does not exist, it creates it with the provided default configuration.
 */
export async function loadConfig<T extends object>(fileName: string, defaultConfig: T): Promise<T> {
    const configPath = join(process.cwd(), fileName);
    const configFile = Bun.file(configPath);

    if (!(await configFile.exists())) {
        console.log(`Creating default configuration: ${fileName}`);
        // @ts-ignore: Bun.YAML.stringify is available at runtime but might be missing in types
        const yamlContent = Bun.YAML.stringify(defaultConfig);
        await Bun.write(configPath, yamlContent);
        return defaultConfig;
    }

    console.log(`Loading configuration from ${configPath}`);
    const content = await configFile.text();
    try {
        const parsed = Bun.YAML.parse(content);
        if (typeof parsed !== 'object' || parsed === null) {
            console.warn(`Config file ${fileName} is not a valid object, using defaults.`);
            return defaultConfig;
        }
        // Deep merge could be better, but shallow merge with defaults is a good start
        return { ...defaultConfig, ...(parsed as object) } as T;
    } catch (error) {
        console.error(`Failed to parse ${fileName}:`, error);
        return defaultConfig;
    }
}
