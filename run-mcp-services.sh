#!/usr/bin/env bash

# ======================================================
# MuseRoom Notion MCP Services Runner
# ======================================================
# This script starts all required services for the Notion MCP integration:
# - Local proxy server (if using proxy mode)
# - Vite development server
#
# Usage: ./run-mcp-services.sh [options]
# 
# See --help for available options
# ======================================================

set -e

# Colors for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
MODE="direct"
VITE_PORT=3000
PROXY_PORT=3005
ENV_FILE=".env"
PROXY_PID=""
VITE_PID=""

# Function to display usage information
show_help() {
  echo -e "${BLUE}MuseRoom Notion MCP Services Runner${NC}"
  echo
  echo "This script starts all required services for the Notion MCP integration."
  echo
  echo -e "${YELLOW}Usage:${NC}"
  echo "  ./run-mcp-services.sh [options]"
  echo
  echo -e "${YELLOW}Options:${NC}"
  echo "  -m, --mode MODE     Set Notion MCP connection mode (direct, proxy, offline)"
  echo "                      default: direct"
  echo "  -p, --port PORT     Set Vite development server port"
  echo "                      default: 3000"
  echo "  --proxy-port PORT   Set proxy server port"
  echo "                      default: 3005"
  echo "  -h, --help          Show this help message"
  echo
  echo -e "${YELLOW}Examples:${NC}"
  echo "  ./run-mcp-services.sh --mode direct    # Use direct MCP connection (default)"
  echo "  ./run-mcp-services.sh --mode proxy     # Use local proxy server"
  echo "  ./run-mcp-services.sh --mode offline   # Use offline mock mode"
  echo
  echo -e "${YELLOW}Connection Modes:${NC}"
  echo "  direct  - Connect directly to Notion MCP server (requires beta access)"
  echo "  proxy   - Use local proxy server (works without beta access)"
  echo "  offline - Use offline mock mode (no internet connection required)"
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to check for required dependencies
check_dependencies() {
  echo -e "${BLUE}Checking dependencies...${NC}"
  
  local missing_deps=0
  
  if ! command_exists node; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    missing_deps=1
  fi
  
  if ! command_exists npm; then
    echo -e "${RED}Error: npm is not installed${NC}"
    echo "Please install npm (usually comes with Node.js)"
    missing_deps=1
  fi
  
  # Check Node.js version (needs to be >= 18)
  if command_exists node; then
    node_version=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$node_version" -lt 18 ]; then
      echo -e "${RED}Error: Node.js version 18 or higher is required${NC}"
      echo "Current version: $(node -v)"
      echo "Please upgrade Node.js from https://nodejs.org/"
      missing_deps=1
    fi
  fi
  
  if [ $missing_deps -eq 1 ]; then
    exit 1
  fi
  
  echo -e "${GREEN}All dependencies are installed!${NC}"
}

# Function to update .env file with the correct MCP mode
update_env_file() {
  local mode=$1
  
  echo -e "${BLUE}Updating environment configuration...${NC}"
  
  # Check if .env file exists
  if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Warning: .env file not found, creating from env.example${NC}"
    if [ -f "env.example" ]; then
      cp env.example "$ENV_FILE"
    else
      echo -e "${RED}Error: Neither .env nor env.example file found${NC}"
      echo "Please create a .env file with the required configuration"
      exit 1
    fi
  fi
  
  # Update or add VITE_NOTION_MCP_MODE in .env file
  if grep -q "VITE_NOTION_MCP_MODE=" "$ENV_FILE"; then
    # Replace existing line
    sed -i.bak "s/VITE_NOTION_MCP_MODE=.*/VITE_NOTION_MCP_MODE=$mode/" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak" # Remove backup file
  else
    # Add new line
    echo "VITE_NOTION_MCP_MODE=$mode" >> "$ENV_FILE"
  fi
  
  # If using proxy mode, make sure VITE_NOTION_PROXY_URL is set
  if [ "$mode" = "proxy" ]; then
    if ! grep -q "VITE_NOTION_PROXY_URL=" "$ENV_FILE"; then
      echo "VITE_NOTION_PROXY_URL=http://localhost:$PROXY_PORT/api/notion" >> "$ENV_FILE"
    fi
    
    # Also make sure ALLOWED_ORIGINS includes the Vite server URL
    if grep -q "ALLOWED_ORIGINS=" "$ENV_FILE"; then
      # Check if our origin is already in the list
      if ! grep -q "ALLOWED_ORIGINS=.*http://localhost:$VITE_PORT" "$ENV_FILE"; then
        # Add our origin to the list
        sed -i.bak "s/ALLOWED_ORIGINS=.*/&,http:\/\/localhost:$VITE_PORT/" "$ENV_FILE"
        rm -f "${ENV_FILE}.bak" # Remove backup file
      fi
    else
      # Add new line
      echo "ALLOWED_ORIGINS=http://localhost:$VITE_PORT" >> "$ENV_FILE"
    fi
  fi
  
  echo -e "${GREEN}Environment configured for ${CYAN}$mode${GREEN} mode!${NC}"
}

# Function to start the proxy server
start_proxy_server() {
  echo -e "${BLUE}Starting Notion proxy server...${NC}"
  
  # Check if server.js exists
  if [ ! -f "server.js" ]; then
    echo -e "${RED}Error: server.js not found${NC}"
    echo "Please make sure you're in the correct directory"
    exit 1
  fi
  
  # Start the proxy server in the background
  node server.js &
  PROXY_PID=$!
  
  # Wait for the server to start
  sleep 2
  
  # Check if the server is running
  if kill -0 $PROXY_PID 2>/dev/null; then
    echo -e "${GREEN}Proxy server started on ${CYAN}http://localhost:$PROXY_PORT${NC}"
  else
    echo -e "${RED}Error: Failed to start proxy server${NC}"
    exit 1
  fi
}

# Function to start the Vite development server
start_vite_server() {
  echo -e "${BLUE}Starting Vite development server...${NC}"
  
  # Start the Vite server in the background
  npm run dev -- --port $VITE_PORT &
  VITE_PID=$!
  
  # Wait for the server to start
  sleep 5
  
  # Check if the server is running
  if kill -0 $VITE_PID 2>/dev/null; then
    echo -e "${GREEN}Vite server started on ${CYAN}http://localhost:$VITE_PORT${NC}"
  else
    echo -e "${RED}Error: Failed to start Vite server${NC}"
    exit 1
  fi
}

# Function to clean up when the script exits
cleanup() {
  echo -e "\n${BLUE}Shutting down services...${NC}"
  
  if [ -n "$PROXY_PID" ]; then
    echo -e "Stopping proxy server (PID: $PROXY_PID)..."
    kill $PROXY_PID 2>/dev/null || true
  fi
  
  if [ -n "$VITE_PID" ]; then
    echo -e "Stopping Vite server (PID: $VITE_PID)..."
    kill $VITE_PID 2>/dev/null || true
  fi
  
  echo -e "${GREEN}All services stopped. Goodbye!${NC}"
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -m|--mode)
      MODE="$2"
      shift 2
      ;;
    -p|--port)
      VITE_PORT="$2"
      shift 2
      ;;
    --proxy-port)
      PROXY_PORT="$2"
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo -e "${RED}Error: Unknown option: $1${NC}"
      show_help
      exit 1
      ;;
  esac
done

# Validate mode
if [[ ! "$MODE" =~ ^(direct|proxy|offline)$ ]]; then
  echo -e "${RED}Error: Invalid mode: $MODE${NC}"
  echo "Valid modes are: direct, proxy, offline"
  exit 1
fi

# Register cleanup function to run on exit
trap cleanup EXIT

# Main execution
clear
echo -e "${PURPLE}======================================================${NC}"
echo -e "${PURPLE}          MuseRoom Notion MCP Services Runner         ${NC}"
echo -e "${PURPLE}======================================================${NC}"
echo

# Check dependencies
check_dependencies

# Update .env file
update_env_file "$MODE"

# Start services based on mode
if [ "$MODE" = "proxy" ]; then
  start_proxy_server
fi

start_vite_server

# Print instructions based on mode
echo
echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}All services started successfully!${NC}"
echo -e "${BLUE}======================================================${NC}"
echo
echo -e "Open ${CYAN}http://localhost:$VITE_PORT${NC} in your browser"
echo

case "$MODE" in
  direct)
    echo -e "${YELLOW}Direct MCP Mode Instructions:${NC}"
    echo "1. Navigate to the Notion MCP tab in the app"
    echo "2. Click 'Connect' to establish connection to Notion MCP server"
    echo "3. When prompted, authenticate with your Notion account"
    echo "4. You should see 'Connected' and 'Authenticated' status"
    ;;
  proxy)
    echo -e "${YELLOW}Proxy Mode Instructions:${NC}"
    echo "1. Navigate to the Notion MCP tab in the app"
    echo "2. The app should automatically use the proxy server"
    echo "3. You should see 'Using Fallback Service' in the status"
    echo
    echo -e "${CYAN}Proxy server is running at:${NC} http://localhost:$PROXY_PORT/api/notion"
    ;;
  offline)
    echo -e "${YELLOW}Offline Mode Instructions:${NC}"
    echo "1. Navigate to the Notion MCP tab in the app"
    echo "2. The app will use mock data for all Notion operations"
    echo "3. You should see 'Offline Mode Active' in the status"
    ;;
esac

echo
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo

# Keep the script running until user presses Ctrl+C
wait $VITE_PID
