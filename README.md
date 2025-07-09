# MuseRoom Voice Agent

A modern voice-enabled web application that allows you to interact with Discord messages through AI voice commands. Built with React, Vite, and advanced voice recognition technology.

## Features

- 🎤 **Voice Recognition**: Talk to the AI using your microphone
- 🔊 **Text-to-Speech**: AI responds with premium ElevenLabs voices or browser TTS
- 📡 **Discord Integration**: Read and send summaries of Discord messages via n8n webhook
- 🎨 **Modern UI**: Beautiful, responsive design with Tailwind CSS
- 📱 **Real-time Updates**: Live conversation history and message display
- 🌓 **Dark/Light Mode**: Toggle between themes
- ⚡ **Fast Performance**: Built with Vite for optimal development experience

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom animations
- **Voice**: Web Speech API + ElevenLabs AI voices (elevenlabs-js v1.2.6)
- **UI Components**: Radix UI primitives
- **Animation**: Framer Motion
- **HTTP Client**: Axios and Fetch API
- **Discord Integration**: n8n webhook automation with OpenAI analysis

## Quick Start

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Create environment file**:

   ```bash
   cp env.example .env
   ```

3. **Start the development server**:

   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to `http://localhost:3000`

## Voice Commands

The AI agent understands various voice commands:

- **"Read latest Discord messages"** - Fetches and reads recent messages
- **"Send Discord summary"** - Sends a summary to your Discord channel
- **"Hello"** or **"Hi"** - Greet the AI assistant
- **"Help"** - Get information about available commands

## Discord Integration

The app integrates with Discord through an n8n webhook automation system:

- **Endpoint**: `https://hadleycarr04.app.n8n.cloud/webhook/discord-message`
- **Processing**: The n8n workflow handles AI analysis, Discord routing, and message formatting
- **Response**: Automated responses are processed through OpenAI and sent to appropriate Discord channels

### How It Works

1. **Voice Input**: User speaks a command (e.g., "Read latest Discord messages")
2. **Speech-to-Text**: Browser converts speech to text
3. **Webhook Call**: App sends the message to the n8n webhook
4. **AI Processing**: n8n uses OpenAI to analyze the request
5. **Discord Action**: Automated system reads/sends messages to Discord
6. **Response**: AI-generated response is returned to the user

### Request Format (As per Boss Specifications)

```json
{
  "message": "Read latest Discord messages",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "source": "voice_app"
}
```

### n8n Automation Workflow

The backend automation handles:

- ✅ OpenAI Analysis of voice commands
- ✅ Format AI Response for Discord
- ✅ Validate Discord Message content
- ✅ Route to appropriate Discord channels
- ✅ Send messages to Discord
- ✅ Handle success/error responses

## Project Structure

```
src/
├── components/
│   ├── VoiceAgent.tsx          # Main voice interface component
│   ├── DiscordMessages.tsx     # Discord message display
│   └── ui/                     # Reusable UI components
├── types/
│   └── speech.d.ts            # Web Speech API type definitions
├── App.tsx                     # Main application component
├── main.tsx                    # Application entry point
└── index.css                   # Global styles and animations
```

## Key Components

### VoiceAgent

The main voice interface that handles:

- Speech recognition using Web Speech API
- Text-to-speech synthesis
- Discord webhook communication
- Conversation history management

### DiscordMessages

Displays Discord messages with:

- Real-time message fetching
- Channel filtering
- Message statistics
- Summary generation

## Browser Support

- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Limited Web Speech API support
- **Safari**: Basic support

## Environment Variables

Create a `.env` file for additional configuration:

```env
# ElevenLabs API Configuration
# Get your API key from: https://elevenlabs.io/speech-synthesis
VITE_ELEVENLABS_API_KEY=your_api_key_here

# Discord Webhook Configuration
VITE_DISCORD_WEBHOOK_URL=https://hadleycarr04.app.n8n.cloud/webhook/discord-message

# Application Configuration
VITE_APP_NAME=MuseRoom Voice Agent
VITE_APP_VERSION=1.0.0
```

### Setting up ElevenLabs

1. **Sign up** at [ElevenLabs](https://elevenlabs.io/speech-synthesis)
2. **Get your API key** from the account dashboard
3. **Add the key** to your `.env` file as `VITE_ELEVENLABS_API_KEY`
4. **Restart the development server** to apply changes

The app will automatically use ElevenLabs for high-quality AI voice synthesis when the API key is configured. If no key is provided, it falls back to the browser's built-in text-to-speech.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Voice Features

### Speech Recognition

- Continuous listening mode
- Real-time transcript display
- Error handling and fallbacks

### Text-to-Speech

- Natural voice synthesis
- Adjustable speech rate and pitch
- Voice controls (play/pause/stop)

### Voice Visualizer

- Animated microphone indicator
- Visual feedback for listening state
- Smooth transitions with Framer Motion

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Troubleshooting

### Common Issues

1. **Microphone not working**: Ensure microphone permissions are granted
2. **Voice synthesis not working**: Check browser compatibility
3. **Discord webhook fails**: Verify webhook URL and network connectivity
4. **PostCSS config error**: If you see ES module errors, the app should still run on port 3001

### Browser Permissions

The app requires:

- **Microphone access** for voice recognition
- **Audio playback** for text-to-speech

## Future Enhancements

- [x] ElevenLabs voice synthesis integration
- [ ] OpenAI GPT integration for smarter responses
- [ ] Multiple Discord server support
- [ ] Voice command customization
- [ ] Message filtering and search
- [ ] Offline mode support

## Support

For issues and questions, please open an issue on the GitHub repository.

---

Built with ❤️ using React, Vite, and modern web technologies.
