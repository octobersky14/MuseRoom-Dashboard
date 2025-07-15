#!/bin/bash
# netlify-build.sh
# Custom build script for Netlify deployment that ensures the mcp-client-typescript
# package is properly built and bundled with Netlify functions

set -e # Exit immediately if any command fails
set -o pipefail # Exit if any command in a pipeline fails

# Function to print colored output for better readability
print_step() {
  echo -e "\033[1;36m==>\033[0m \033[1m$1\033[0m"
}

print_error() {
  echo -e "\033[1;31mERROR:\033[0m \033[1m$1\033[0m" >&2
}

print_success() {
  echo -e "\033[1;32mSUCCESS:\033[0m \033[1m$1\033[0m"
}

# Get the project root directory
PROJECT_ROOT="$(pwd)"
MCP_CLIENT_DIR="$PROJECT_ROOT/mcp-client-typescript"
FUNCTIONS_DIR="$PROJECT_ROOT/netlify/functions"
DIST_DIR="$MCP_CLIENT_DIR/dist"

# Create necessary directories if they don't exist
mkdir -p "$DIST_DIR"
mkdir -p "$FUNCTIONS_DIR/node_modules"

# Step 1: Install dependencies for mcp-client-typescript
print_step "Installing dependencies for mcp-client-typescript"
cd "$MCP_CLIENT_DIR"
if [ ! -f "package-lock.json" ]; then
  npm install
else
  npm ci
fi

# Step 2: Build the TypeScript code
print_step "Building mcp-client-typescript package"
npm run build || {
  print_error "Failed to build mcp-client-typescript with npm run build"
  
  # Fallback to manual TypeScript compilation if the build script fails
  print_step "Attempting manual TypeScript compilation"
  if command -v npx &> /dev/null; then
    npx tsc --outDir dist index.ts || {
      print_error "Manual TypeScript compilation failed"
      exit 1
    }
  else
    print_error "npx not found, installing typescript globally"
    npm install -g typescript
    tsc --outDir dist index.ts || {
      print_error "Manual TypeScript compilation failed"
      exit 1
    }
  fi
}

# Verify the build output exists
if [ ! -f "$DIST_DIR/index.js" ]; then
  print_error "Build failed: $DIST_DIR/index.js does not exist"
  exit 1
fi

# Make the output file executable
chmod +x "$DIST_DIR/index.js"

# Step 3: Create a CommonJS wrapper if needed
print_step "Creating CommonJS wrapper for compatibility"
cat > "$DIST_DIR/index.cjs" << 'EOF'
// CommonJS wrapper for ES module
try {
  const { MCPClient } = require('./index.js');
  module.exports = { MCPClient };
} catch (error) {
  console.error('Error importing ES module:', error);
  // Attempt dynamic import as fallback
  (async () => {
    try {
      const { MCPClient } = await import('./index.js');
      module.exports = { MCPClient };
    } catch (err) {
      console.error('Dynamic import also failed:', err);
      throw err;
    }
  })();
}
EOF

# Step 4: Create a package.json in the dist directory
print_step "Creating package.json in dist directory"
cat > "$DIST_DIR/package.json" << EOF
{
  "name": "mcp-client-typescript",
  "version": "1.0.0",
  "main": "index.js",
  "type": "module",
  "exports": {
    ".": {
      "import": "./index.js",
      "require": "./index.cjs"
    }
  }
}
EOF

# Step 5: Install dependencies for Netlify functions
print_step "Installing dependencies for Netlify functions"
cd "$FUNCTIONS_DIR"
if [ ! -f "package.json" ]; then
  # Create package.json if it doesn't exist
  cat > "package.json" << EOF
{
  "name": "netlify-functions",
  "version": "1.0.0",
  "description": "Netlify Functions for MuseRoom Dashboard",
  "private": true,
  "dependencies": {
    "@anthropic-ai/sdk": "^0.36.3",
    "@modelcontextprotocol/sdk": "^1.15.1",
    "dotenv": "^16.6.1"
  }
}
EOF
fi

npm install

# Step 6: Create a symlink or copy the mcp-client-typescript to the functions node_modules
print_step "Setting up mcp-client-typescript for Netlify functions"
MCP_CLIENT_FUNCTIONS_DIR="$FUNCTIONS_DIR/node_modules/mcp-client-typescript"
mkdir -p "$MCP_CLIENT_FUNCTIONS_DIR"

# Copy the built files to the functions node_modules directory
cp -r "$DIST_DIR"/* "$MCP_CLIENT_FUNCTIONS_DIR/"
cp "$MCP_CLIENT_DIR/package.json" "$MCP_CLIENT_FUNCTIONS_DIR/"

# Step 7: Build the main project
print_step "Building the main project"
cd "$PROJECT_ROOT"
npm run build

# Step 8: Create a _redirects file in the publish directory if it doesn't exist
if [ ! -f "$PROJECT_ROOT/dist/_redirects" ]; then
  print_step "Creating _redirects file for SPA routing"
  echo "/*    /index.html   200" > "$PROJECT_ROOT/dist/_redirects"
fi

# Step 9: Copy the mcp-client-typescript dist to the publish directory for direct access
print_step "Copying mcp-client-typescript to publish directory"
mkdir -p "$PROJECT_ROOT/dist/mcp-client-typescript"
cp -r "$DIST_DIR"/* "$PROJECT_ROOT/dist/mcp-client-typescript/"

print_success "Build completed successfully!"
print_step "Netlify function should now be able to find the MCP client at:"
echo "  - $FUNCTIONS_DIR/node_modules/mcp-client-typescript/index.js"
echo "  - $PROJECT_ROOT/dist/mcp-client-typescript/index.js"

exit 0
