#!/bin/bash

# Test script for n8n webhook
# Replace YOUR_WEBHOOK_URL with your actual n8n webhook URL

WEBHOOK_URL="YOUR_WEBHOOK_URL"

# Check if webhook URL is set
if [ "$WEBHOOK_URL" = "https://hadleycarr04.app.n8n.cloud/webhook/804e229c-1610-4155-b24f-880c370bafc4" ]; then
    echo "❌ Please set your actual webhook URL in this script"
    echo "   Replace 'YOUR_WEBHOOK_URL' with your n8n webhook URL"
    exit 1
fi

echo "🔗 Testing n8n webhook: $WEBHOOK_URL"
echo "📤 Sending test message..."

# Test payload matching what the React app sends
curl -X GET "https://hadleycarr04.app.n8n.cloud/webhook/804e229c-1610-4155-b24f-880c370bafc4?message=Hello%20from%20terminal%20test!&sessionId=terminal-test-session" \
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