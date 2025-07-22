#!/bin/bash

# Test script for n8n webhook
# Set your webhook URL as an environment variable: export VITE_N8N_WEBHOOK_URL="your_webhook_url"

WEBHOOK_URL="${VITE_N8N_WEBHOOK_URL:-YOUR_WEBHOOK_URL}"

# Check if webhook URL is set
if [ "$WEBHOOK_URL" = "YOUR_WEBHOOK_URL" ]; then
    echo "❌ Please set your webhook URL as an environment variable:"
    echo "   export VITE_N8N_WEBHOOK_URL=\"your_webhook_url\""
    exit 1
fi

echo "🔗 Testing n8n webhook: $WEBHOOK_URL"
echo "📤 Sending test message..."

# Test payload matching what the React app sends
curl -X GET "$WEBHOOK_URL?message=Hello%20from%20terminal%20test!&sessionId=terminal-test-session" \
  -H "Content-Type: application/json" \
  -w "\n\n📊 Response Status: %{http_code}\n📊 Response Time: %{time_total}s\n" \
  -s

echo ""
echo "✅ Test completed!"
echo ""
echo "📝 Expected responses:"
echo "   - HTTP 200: Webhook is working"
echo "   - HTTP 404: Webhook URL is incorrect"
echo "   - HTTP 403: CORS issue or workflow not active"
echo "   - Connection refused: n8n instance is down" 