#!/usr/bin/env node
/**
 * Manual build script for mcp-client-typescript
 * 
 * This script compiles the TypeScript code to JavaScript and ensures
 * the output is in the correct location. It serves as a fallback if
 * the standard build process fails.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const sourceFile = 'index.ts';
const outputDir = 'dist';
const outputFile = path.join(outputDir, 'index.js');

// Ensure output directory exists
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Compile TypeScript to JavaScript
function compileTypeScript() {
  try {
    console.log('Compiling TypeScript...');
    
    // Check if TypeScript is installed
    try {
      execSync('npx tsc --version', { stdio: 'pipe' });
    } catch (error) {
      console.log('TypeScript not found, installing...');
      execSync('npm install --no-save typescript@latest', { stdio: 'inherit' });
    }
    
    // Compile with TypeScript
    execSync(`npx tsc --outDir ${outputDir} ${sourceFile}`, { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    console.log(`Successfully compiled to ${outputFile}`);
    return true;
  } catch (error) {
    console.error('Failed to compile TypeScript:', error.message);
    return false;
  }
}

// Make the output file executable
function makeExecutable(filePath) {
  try {
    // Check if we're on a Unix-like system
    if (process.platform !== 'win32') {
      console.log(`Making ${filePath} executable...`);
      fs.chmodSync(filePath, '755');
    }
    return true;
  } catch (error) {
    console.error('Failed to make file executable:', error.message);
    return false;
  }
}

// Create a CommonJS wrapper if needed
function createCommonJSWrapper() {
  try {
    // Check if the file uses ES modules
    const content = fs.readFileSync(outputFile, 'utf8');
    
    if (content.includes('export ') || content.includes('import ')) {
      console.log('Creating CommonJS wrapper for ES modules...');
      
      // Create a CommonJS compatible file
      const wrapperPath = path.join(outputDir, 'index.cjs');
      const wrapper = `
// CommonJS wrapper for ES module
try {
  const { MCPClient } = await import('./index.js');
  module.exports = { MCPClient };
} catch (error) {
  console.error('Error importing ES module:', error);
  throw error;
}
      `.trim();
      
      fs.writeFileSync(wrapperPath, wrapper);
      console.log(`Created CommonJS wrapper at ${wrapperPath}`);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to create CommonJS wrapper:', error.message);
    return false;
  }
}

// Create a package.json in the dist directory
function createDistPackageJson() {
  try {
    console.log('Creating package.json in dist directory...');
    
    const packageJson = {
      name: "mcp-client-typescript",
      version: "1.0.0",
      main: "index.js",
      type: "module",
      exports: {
        ".": {
          "import": "./index.js",
          "require": "./index.cjs"
        }
      }
    };
    
    fs.writeFileSync(
      path.join(outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    console.log('Created package.json in dist directory');
    return true;
  } catch (error) {
    console.error('Failed to create package.json:', error.message);
    return false;
  }
}

// Main build process
async function build() {
  console.log('Starting manual build process...');
  
  // Ensure the output directory exists
  ensureDirectoryExists(outputDir);
  
  // Compile TypeScript
  if (!compileTypeScript()) {
    process.exit(1);
  }
  
  // Make the output file executable
  if (!makeExecutable(outputFile)) {
    process.exit(1);
  }
  
  // Create CommonJS wrapper
  if (!createCommonJSWrapper()) {
    process.exit(1);
  }
  
  // Create package.json in dist
  if (!createDistPackageJson()) {
    process.exit(1);
  }
  
  console.log('Build completed successfully!');
}

// Run the build process
build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
