// n8n Configuration
export const n8nConfig = {
  // Webhook URL for the n8n chat workflow
  // Replace this with your actual n8n webhook URL
  webhookUrl: import.meta.env.VITE_CHAT_WEBHOOK_URL || "",

  // Chat configuration
  chat: {
    mode: "window" as "window" | "fullscreen",
    showWelcomeScreen: true,
    allowFileUploads: true,
    allowedFilesMimeTypes: "image/*,application/pdf,text/*",
    loadPreviousSession: true,
  },

  // Workflow settings
  workflow: {
    // Timeout for webhook requests (in milliseconds)
    timeout: 30000,

    // Retry configuration
    retries: 3,
    retryDelay: 1000,
  },

  // UI customization
  ui: {
    title: "MuseRoom AI Assistant",
    subtitle: "Your intelligent workspace companion",
    footer: "Powered by n8n & MuseRoom",
    placeholder: "Ask me anything about your workspace...",
  },
};

// Helper function to validate webhook URL
export const isValidWebhookUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

// Helper function to get webhook URL with validation
export const getWebhookUrl = (): string => {
  const url = n8nConfig.webhookUrl;
  if (!url) {
    console.warn(
      "CHAT_WEBHOOK_URL is not configured. Please set VITE_CHAT_WEBHOOK_URL in your environment variables."
    );
    return "";
  }

  if (!isValidWebhookUrl(url)) {
    console.error(
      "Invalid CHAT_WEBHOOK_URL format. Please check your environment configuration."
    );
    return "";
  }

  return url;
};
