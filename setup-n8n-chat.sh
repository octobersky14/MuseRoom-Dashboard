#!/bin/bash

# MuseRoom Dashboard - n8n Chat Setup Script
# This script helps you set up the n8n chat integration

echo "🎵 MuseRoom Dashboard - n8n Chat Setup"
echo "======================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🔧 Configuration Steps:"
echo "======================="
echo ""
echo "1. 📋 Create an n8n workflow:"
echo "   - Go to https://cloud.n8n.io/ (or install locally)"
echo "   - Create a new workflow with: Chat Trigger → AI Agent → Respond to Webhook"
echo "   - Add your domain to 'Allowed Origins (CORS)' in the Chat Trigger node"
echo ""
echo "2. 🔗 Get your webhook URL:"
echo "   - Activate your workflow in n8n"
echo "   - Copy the webhook URL from the Chat Trigger node"
echo ""
echo "3. ⚙️  Configure environment variables:"
echo "   - Edit .env file"
echo "   - Set VITE_N8N_WEBHOOK_URL to your webhook URL"
echo ""
echo "4. 🚀 Start the development server:"
echo "   npm run dev"
echo ""
echo "📚 For detailed instructions, see: N8N_INTEGRATION.md"
echo ""
echo "🎉 Setup complete! Happy chatting!" 