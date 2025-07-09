# MuseRoom Voice Agent Setup Guide

## Quick Start

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up environment variables**:

   ```bash
   cp env.example .env
   ```

3. **Add your ElevenLabs API key** (optional but recommended):

   - Go to [ElevenLabs Speech Synthesis](https://elevenlabs.io/speech-synthesis)
   - Sign up for a free account
   - Find your API key in your profile settings
   - Edit `.env` and uncomment the line: `VITE_ELEVENLABS_API_KEY=your_api_key_here`
   - Replace `your_api_key_here` with your actual API key

4. **Start the development server**:

   ```bash
   npm run dev
   ```

5. **Open your browser** and go to `http://localhost:3000`

## ElevenLabs Integration

### Without API Key

- App uses browser's built-in text-to-speech
- Still fully functional but with basic voice quality

### With API Key

- High-quality AI voices from ElevenLabs
- Multiple voice options available
- Professional audio quality
- Real-time voice synthesis

### Getting Your API Key

1. Visit [ElevenLabs](https://elevenlabs.io/speech-synthesis)
2. Create a free account
3. Go to your profile settings
4. Copy your API key
5. Add it to your `.env` file

### Voice Selection

Once configured, you can:

- Choose from 10+ premium AI voices
- Test different voices in the app
- Switch between ElevenLabs and browser voice
- Adjust voice settings for optimal quality

## Troubleshooting

### Common Issues

1. **"ElevenLabs unavailable"** - Check your API key in `.env`
2. **Voice not playing** - Ensure browser allows audio playback
3. **No voices loaded** - Verify internet connection and API key

### Browser Support

- **Chrome/Edge**: Best performance with ElevenLabs
- **Firefox**: Limited Web Speech API support
- **Safari**: Basic functionality

### Performance Tips

- ElevenLabs voices require internet connection
- Browser voices work offline
- Use voice test button to verify setup
- Check network console for API errors

## Features

✅ **Voice Recognition**: Web Speech API  
✅ **ElevenLabs Integration**: REST API implementation  
✅ **Discord Integration**: n8n webhook support  
✅ **Voice Selection**: Multiple AI voices  
✅ **Fallback Support**: Browser TTS backup  
✅ **Real-time UI**: Live conversation history

## Next Steps

1. Test voice recognition with microphone
2. Try different ElevenLabs voices
3. Use Discord integration features
4. Explore voice commands and responses

For more detailed information, see the main [README.md](README.md) file.
