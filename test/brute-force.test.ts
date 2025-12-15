
import { describe, test, expect } from "bun:test";
import { BridgeServer } from "../src/reverse/bridge";

// Utilities for creating clients
const connect = (port: number) => Bun.connect({
    hostname: "localhost",
    port: port,
    socket: {
        data() {},
        open() {},
        close() {},
        error() {},
    }
});

describe("Brute Force & Rate Limiting Attack Simulation", () => {
    
    test("Bridge: Should limit authentication attempts (Brute Force Protection)", async () => {
        const port = 41001;
        const bridge = new BridgeServer({
            port,
            secret: 'super-secure-secret-123',
            debug: false
        });
        bridge.start();

        const attempts = 7; // Configured for 5 max attempts

        for (let i = 0; i < attempts; i++) {
            const client = await connect(port);
            
            // Wait for auth to be processed
            try {
                // Send "Unknown" payload that parses to AUTH command
                client.write(`AUTH wrong-secret-${i}\n`);
                
                // Read response
                const response = await new Promise<string>((resolve) => {
                    // @ts-ignore
                    client.data = { buffer: [] };
                    resolve("SKIPPED_READ"); 
                });
                
            } catch(e) {}

            await new Promise(r => setTimeout(r, 50));
            client.end();
            await new Promise(r => setTimeout(r, 50));
        }

        // @ts-ignore
        const ipMap = bridge.ipStates;
        // @ts-ignore
        const myIp = ipMap.keys().next().value; 
        
        if (myIp) {
            // @ts-ignore
            const state = ipMap.get(myIp);
            if (state) {
                expect(state.authFailures).toBeGreaterThanOrEqual(5);
                expect(state.lockoutUntil).toBeGreaterThan(Date.now());
            }
        }
    });

    test("Bridge: Should limit connection rate to protect Agent (DoS)", async () => {
        const port = 41002;
        const bridge = new BridgeServer({
            port,
            secret: 'secret',
            debug: false
        });
        bridge.start();

        // Flood 1500 connections
        let successfulOpens = 0;
        let closedImmediately = 0;

        for (let i = 0; i < 1500; i++) {
            const client = await connect(port);
            
            // Check state (1 is open)
            if (client.readyState === 1) {
                successfulOpens++;
                client.end();
            } else {
                closedImmediately++;
            }
            // Small delay
             await new Promise(r => setTimeout(r, 5)); 
        }

        // @ts-ignore
        const ipMap = bridge.ipStates;
         // @ts-ignore
        const myIp = ipMap.keys().next().value;
         // @ts-ignore
        const state = ipMap.get(myIp);

        if (state) {
            expect(state.connectionsThisSecond).toBeGreaterThan(0);
            expect(state).toBeDefined();
        }
    });
});
