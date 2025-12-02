import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export function loadEnv() {
    try {
        const envPath = join(process.cwd(), '.env');
        if (existsSync(envPath)) {
            console.log(`Loading configuration from ${envPath}`);
            const content = readFileSync(envPath, 'utf-8');
            for (const line of content.split('\n')) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('#')) continue;

                const match = trimmedLine.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1]!.trim();
                    let value = match[2]!.trim();

                    // Remove surrounding quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }

                    if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            }
        }
    } catch (error) {
        console.warn('Failed to load .env file:', error);
    }
}
