import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { loadEnv } from '../src/utils/env-loader.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('Env Loader', () => {
    const envPath = join(process.cwd(), '.env');
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Clear relevant env vars
        delete process.env.TEST_VAR;
        delete process.env.TEST_VAR_QUOTED;
        delete process.env.TEST_VAR_SINGLE_QUOTED;
        delete process.env.EXISTING_VAR;
    });

    afterEach(() => {
        // Restore env
        process.env = { ...originalEnv };
        // Clean up .env file
        if (existsSync(envPath)) {
            unlinkSync(envPath);
        }
    });

    it('should load variables from .env file', () => {
        writeFileSync(envPath, 'TEST_VAR=hello_world\n');
        loadEnv();
        expect(process.env.TEST_VAR).toBe('hello_world');
    });

    it('should handle quoted values', () => {
        writeFileSync(envPath, 'TEST_VAR_QUOTED="hello world"\nTEST_VAR_SINGLE_QUOTED=\'hello world\'\n');
        loadEnv();
        expect(process.env.TEST_VAR_QUOTED).toBe('hello world');
        expect(process.env.TEST_VAR_SINGLE_QUOTED).toBe('hello world');
    });

    it('should ignore comments and empty lines', () => {
        writeFileSync(envPath, '\n# This is a comment\nTEST_VAR=value\n\n');
        loadEnv();
        expect(process.env.TEST_VAR).toBe('value');
    });

    it('should not overwrite existing environment variables', () => {
        process.env.EXISTING_VAR = 'original';
        writeFileSync(envPath, 'EXISTING_VAR=new_value\n');
        loadEnv();
        expect(process.env.EXISTING_VAR).toBe('original');
    });

    it('should handle missing .env file gracefully', () => {
        if (existsSync(envPath)) unlinkSync(envPath);
        expect(() => loadEnv()).not.toThrow();
    });
});
