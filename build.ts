#!/usr/bin/env bun

/**
 * Simple multi-platform build script
 * Compiles the application for Windows, Linux, and macOS in the /dist-build folder
 */

import { spawn } from "bun";
import { mkdir } from "fs/promises";
import { join } from "path";

// Configuration 
const ENTRIES = [
  { src: "./src/bin/agent.ts", name: "tunnel-agent" },
  { src: "./src/bin/bridge.ts", name: "bridge-server" },
  { src: "./src/bin/proxy.ts", name: "simple-proxy" },
];
const DIST_DIR = "./dist-build";

// Multi-platform targets
const TARGETS = [
  {
    name: "windows-x64",
    target: "bun-windows-x64",
    ext: ".exe",
  },
  { name: "linux-x64", target: "bun-linux-x64", ext: "" },
  {
    name: "linux-arm64",
    target: "bun-linux-arm64",
    ext: "",
  },
  { name: "macos-x64", target: "bun-darwin-x64", ext: "" },
  {
    name: "macos-arm64",
    target: "bun-darwin-arm64",
    ext: "",
  },
];

async function buildApp() {
  try {
    // Create distribution directory if it doesn't exist
    await mkdir(DIST_DIR, { recursive: true });
    console.log(`📁 Build directory: ${DIST_DIR}`);

    // Build for each entry and platform
    for (const entry of ENTRIES) {
      console.log(`\n📦 Building ${entry.name}...`);

      for (const platform of TARGETS) {
        const outfile = `${entry.name}-${platform.name}${platform.ext}`;
        const outPath = join(DIST_DIR, outfile);

        console.log(`  🔨 Building for ${platform.name}...`);

        const command = [
          "bun",
          "build",
          entry.src,
          "--compile",
          `--target=${platform.target}`,
          `--outfile=${outPath}`,
          "--minify",
        ];

        // Execute the command using Bun.spawn
        const process = spawn({
          cmd: command,
          stdout: "inherit",
          stderr: "inherit",
        });

        // Wait for the process to complete
        const exitCode = await process.exited;

        if (exitCode === 0) {
          console.log(`  ✅ Created ${outfile}`);
        } else {
          console.error(
            `  ❌ Build failed for ${outfile} with exit code: ${exitCode}`,
          );
        }
      }
    }

    console.log("\n🎉 Multi-platform build completed!");
    console.log(`📦 Executables generated in: ${DIST_DIR}`);
  } catch (error) {
    console.error(`❌ Error during build:`, error);
    process.exit(1);
  }
}

// Execute the build
buildApp();
