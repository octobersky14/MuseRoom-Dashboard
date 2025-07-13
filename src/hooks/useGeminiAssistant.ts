import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
// Prefer alias import so the path resolves regardless of relative depth
import GeminiService from '@/services/geminiService';

// Define message interface
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  intent?: string;
  intentConfidence?: number;
}

// Define hook return type
interface UseGeminiAssistantReturn {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  sendMessage: (message: string) => Promise<string>;
  clearMessages: () => void;
  detectIntent: (message: string) => Promise<{
    intent: 'notion' | 'discord' | 'calendar' | 'general';
    confidence: number;
    action?: string;
    params?: Record<string, any>;
  }>;
  speakMessage: (text: string, voiceId?: string) => Promise<void>;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  lastDetectedIntent: {
    intent: string;
    confidence: number;
    action?: string;
  } | null;
}

// Define hook options
interface UseGeminiAssistantOptions {
  apiKey?: string;
  elevenLabsApiKey?: string;
  selectedVoice?: string;
  useElevenLabs?: boolean;
  systemInstruction?: string;
  initialMessages?: Message[];
  onError?: (error: Error) => void;
  onIntentDetected?: (intent: string, confidence: number, action?: string) => void;
}

/**
 * React hook for using Gemini AI assistant with ElevenLabs voice
 */
export const useGeminiAssistant = (options: UseGeminiAssistantOptions = {}): UseGeminiAssistantReturn => {
  // Extract options with defaults
  const {
    apiKey = import.meta.env.VITE_GEMINI_API_KEY || '',
    elevenLabsApiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || '',
    selectedVoice = 'EXAVITQu4vr4xnSDxMaL', // Default ElevenLabs voice
    useElevenLabs = !!elevenLabsApiKey,
    systemInstruction,
    initialMessages = [],
    onError,
    onIntentDetected,
  } = options;

  // State
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [lastDetectedIntent, setLastDetectedIntent] = useState<{
    intent: string;
    confidence: number;
    action?: string;
  } | null>(null);

  // Refs
  const geminiServiceRef = useRef<GeminiService | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Gemini service
  useEffect(() => {
    if (apiKey) {
      try {
        geminiServiceRef.current = new GeminiService(apiKey);
        
        if (systemInstruction) {
          geminiServiceRef.current.setSystemInstruction(systemInstruction);
        }
        
        // Set default system instruction if none provided
        if (!systemInstruction) {
          geminiServiceRef.current.setSystemInstruction(
            `You are an AI assistant integrated into the MuseRoom Dashboard. 
            You can help users with Notion, Discord, and Google Calendar. 
            You should be helpful, concise, and friendly.`
          );
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to initialize Gemini service');
        setError(error);
        if (onError) onError(error);
      }
    } else {
      setError(new Error('Gemini API key is required'));
      if (onError) onError(new Error('Gemini API key is required'));
    }

    // Clean up on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [apiKey, systemInstruction, onError]);

  // Generate a unique ID for messages
  const generateId = useCallback(() => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }, []);

  // Send a message to Gemini and get a response
  const sendMessage = useCallback(
    async (messageText: string): Promise<string> => {
      if (!geminiServiceRef.current) {
        const error = new Error('Gemini service not initialized');
        setError(error);
        if (onError) onError(error);
        return '';
      }

      setIsLoading(true);
      setError(null);

      try {
        // Add user message to state
        const userMessage: Message = {
          id: generateId(),
          role: 'user',
          content: messageText,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);

        // Send to Gemini and get response
        const response = await geminiServiceRef.current.processMessage(messageText);

        // Detect intent from the message
        const intentResult = await geminiServiceRef.current.detectIntent(messageText);
        
        // Update last detected intent
        setLastDetectedIntent({
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          action: intentResult.action,
        });

        // Notify about intent if callback provided
        if (onIntentDetected) {
          onIntentDetected(
            intentResult.intent, 
            intentResult.confidence, 
            intentResult.action
          );
        }

        // Add assistant response to state
        const assistantMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          intent: intentResult.intent,
          intentConfidence: intentResult.confidence,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Speak the response if needed
        if (useElevenLabs && elevenLabsApiKey) {
          await speakMessage(response, selectedVoice);
        }

        setIsLoading(false);
        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to send message to Gemini');
        setError(error);
        if (onError) onError(error);
        setIsLoading(false);
        return '';
      }
    },
    [
      generateId, 
      useElevenLabs, 
      elevenLabsApiKey, 
      selectedVoice, 
      onError, 
      onIntentDetected
    ]
  );

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    if (geminiServiceRef.current) {
      geminiServiceRef.current.clearHistory();
    }
  }, []);

  // Detect intent from a message
  const detectIntent = useCallback(
    async (message: string) => {
      if (!geminiServiceRef.current) {
        throw new Error('Gemini service not initialized');
      }
      
      try {
        const intentResult = await geminiServiceRef.current.detectIntent(message);
        
        // Update last detected intent
        setLastDetectedIntent({
          intent: intentResult.intent,
          confidence: intentResult.confidence,
          action: intentResult.action,
        });
        
        // Notify about intent if callback provided
        if (onIntentDetected) {
          onIntentDetected(
            intentResult.intent, 
            intentResult.confidence, 
            intentResult.action
          );
        }
        
        return intentResult;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to detect intent');
        setError(error);
        if (onError) onError(error);
        throw error;
      }
    },
    [onError, onIntentDetected]
  );

  // Speak a message using ElevenLabs
  const speakMessage = useCallback(
    async (text: string, voiceId?: string): Promise<void> => {
      if (!useElevenLabs || !elevenLabsApiKey) {
        // Fallback to browser's text-to-speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
        return;
      }

      try {
        setIsSpeaking(true);
        
        // Stop any current audio playback
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        // Create a new audio element
        const audio = new Audio();
        audioRef.current = audio;
        
        // Set up audio event handlers
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => {
          setIsSpeaking(false);
          setError(new Error('Failed to play audio'));
          if (onError) onError(new Error('Failed to play audio'));
        };

        // Make request to ElevenLabs API
        const response = await axios.post(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || selectedVoice}`,
          {
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
          },
          {
            headers: {
              'xi-api-key': elevenLabsApiKey,
              'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer',
          }
        );

        // Create blob and URL from response
        const blob = new Blob([response.data], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        
        // Set the source and play
        audio.src = url;
        await audio.play();
        
        // Clean up URL when done
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
      } catch (err) {
        setIsSpeaking(false);
        const error = err instanceof Error ? err : new Error('Failed to speak message');
        setError(error);
        if (onError) onError(error);
        
        // Fallback to browser's text-to-speech (with speaking state updates)
        const fallbackUtterance = new SpeechSynthesisUtterance(text);
        fallbackUtterance.onstart = () => setIsSpeaking(true);
        fallbackUtterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(fallbackUtterance);
      }
    },
    [useElevenLabs, elevenLabsApiKey, selectedVoice, onError]
  );

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  // Return the hook interface
  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    detectIntent,
    speakMessage,
    stopSpeaking,
    isSpeaking,
    lastDetectedIntent,
  };
};

export default useGeminiAssistant;
