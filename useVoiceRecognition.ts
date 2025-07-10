import { useState, useEffect, useCallback, useRef } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

// Define confidence levels for transcription
export enum TranscriptConfidence {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

// Define recognition status states
export enum RecognitionStatus {
  INACTIVE = 'inactive',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  ERROR = 'error'
}

// Interface for the hook return value
export interface VoiceRecognitionHook {
  transcript: string;
  isListening: boolean;
  status: RecognitionStatus;
  confidence: TranscriptConfidence;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
  confirmTranscript: () => string;
  updateTranscript: (newTranscript: string) => void;
  browserSupportsSpeechRecognition: boolean;
  isMicrophoneAvailable: boolean | null;
  errorMessage: string | null;
}

// Setup browser compatibility for SpeechRecognition
const initBrowserSpeechRecognition = (): boolean => {
  try {
    // Check if the browser supports the Web Speech API
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    window.SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
    window.SpeechRecognitionEvent = window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;
    
    console.log('SpeechRecognition initialized with:', {
      SpeechRecognition: !!window.SpeechRecognition,
      webkitSpeechRecognition: !!window.webkitSpeechRecognition
    });
    
    return !!window.SpeechRecognition || !!window.webkitSpeechRecognition;
  } catch (error) {
    console.error('Error initializing SpeechRecognition:', error);
    return false;
  }
};

/**
 * Custom hook for voice recognition functionality
 * Integrates with react-speech-recognition for browser compatibility
 */
const useVoiceRecognition = (): VoiceRecognitionHook => {
  // Initialize browser compatibility
  const isSupported = initBrowserSpeechRecognition();
  
  // Get base functionality from react-speech-recognition
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable
  } = useSpeechRecognition({
    clearTranscriptOnListen: true,
    commands: []
  });

  // State for recognition status
  const [status, setStatus] = useState<RecognitionStatus>(RecognitionStatus.INACTIVE);
  
  // State for transcript confidence
  const [confidence, setConfidence] = useState<TranscriptConfidence>(TranscriptConfidence.HIGH);
  
  // State for editable transcript (for low confidence cases)
  const [editableTranscript, setEditableTranscript] = useState<string>('');
  
  // State for error message
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // State for microphone permission
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  
  // Ref to track silence duration
  const silenceTimer = useRef<number | null>(null);
  
  // Ref to track if we're in continuous mode
  const isContinuousMode = useRef<boolean>(true);
  
  // Ref to track raw transcript from recognition
  const rawTranscriptRef = useRef<string>('');
  
  // Ref to track if we're trying to start listening
  const isStartingListening = useRef<boolean>(false);
  
  // Ref to track retry attempts
  const retryAttempts = useRef<number>(0);
  const maxRetryAttempts = 3;

  // Log initialization status
  useEffect(() => {
    console.log('Voice Recognition Hook initialized with:', {
      browserSupportsSpeechRecognition,
      isMicrophoneAvailable,
      isSupported
    });
    
    if (!browserSupportsSpeechRecognition) {
      setErrorMessage('Your browser does not support speech recognition.');
      setStatus(RecognitionStatus.ERROR);
    }
    
    // Check for existing microphone permissions on component mount
    const checkMicrophonePermission = async () => {
      try {
        if (navigator.permissions) {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setMicPermission(permissionStatus.state as 'granted' | 'denied' | 'prompt');
          
          console.log('Initial microphone permission state:', permissionStatus.state);
          
          // Listen for permission changes
          permissionStatus.onchange = () => {
            console.log('Microphone permission changed to:', permissionStatus.state);
            setMicPermission(permissionStatus.state as 'granted' | 'denied' | 'prompt');
            
            if (permissionStatus.state === 'granted') {
              setErrorMessage(null);
            } else if (permissionStatus.state === 'denied') {
              setErrorMessage('Microphone access was denied. Please allow microphone access in your browser settings.');
              setStatus(RecognitionStatus.ERROR);
            }
          };
        } else {
          console.log('Permissions API not supported, will request permissions when needed');
        }
      } catch (error) {
        console.error('Error checking microphone permission:', error);
      }
    };
    
    checkMicrophonePermission();
  }, [browserSupportsSpeechRecognition, isSupported]);

  // Update editable transcript when the actual transcript changes
  useEffect(() => {
    if (transcript) {
      console.log('Transcript updated:', transcript);
      rawTranscriptRef.current = transcript;
      setEditableTranscript(transcript);
      
      // Estimate confidence based on transcript characteristics
      estimateConfidence(transcript);
    }
  }, [transcript]);

  // Update status based on listening state
  useEffect(() => {
    console.log('Listening state changed:', listening);
    
    if (listening) {
      console.log('Speech recognition is now actively listening');
      setStatus(RecognitionStatus.LISTENING);
      isStartingListening.current = false; // Reset the starting flag since we're now listening
      retryAttempts.current = 0; // Reset retry attempts
      
      // Reset silence timer when we start listening
      if (silenceTimer.current) {
        window.clearTimeout(silenceTimer.current);
      }
      
      // Set up silence detection
      silenceTimer.current = window.setTimeout(() => {
        // If we're still listening after silence period, stop
        if (listening) {
          console.log('Silence detected, stopping listening');
          SpeechRecognition.stopListening();
        }
      }, 5000); // 5 seconds of silence will trigger a stop
    } else {
      // If we were trying to start listening but listening is false,
      // and we haven't exceeded max retries, try again
      if (isStartingListening.current && retryAttempts.current < maxRetryAttempts) {
        console.log(`Listening failed to start, retrying (attempt ${retryAttempts.current + 1}/${maxRetryAttempts})`);
        
        // Increment retry counter
        retryAttempts.current++;
        
        // Try again with a delay that increases with each retry
        const retryDelay = 300 * Math.pow(2, retryAttempts.current - 1); // Exponential backoff
        setTimeout(() => {
          console.log(`Retrying speech recognition start after ${retryDelay}ms delay`);
          forceStartListening();
        }, retryDelay);
      } else if (transcript && status !== RecognitionStatus.INACTIVE) {
        // If we have a transcript and we're not inactive, we're processing
        setStatus(RecognitionStatus.PROCESSING);
        console.log('Processing final transcript:', transcript || rawTranscriptRef.current);
      } else if (status !== RecognitionStatus.ERROR) {
        // Otherwise, if we're not in an error state, we're inactive
        setStatus(RecognitionStatus.INACTIVE);
        console.log('Speech recognition is now inactive');
        
        // If we were trying to start but failed after all retries
        if (isStartingListening.current && retryAttempts.current >= maxRetryAttempts) {
          console.log('Failed to start speech recognition after multiple attempts');
          setErrorMessage('Failed to start speech recognition. Please try again.');
          isStartingListening.current = false;
        }
      }
    }
  }, [listening, transcript, status]);

  /**
   * Estimate confidence level based on transcript characteristics
   * This is a simple heuristic and could be improved with more sophisticated analysis
   */
  const estimateConfidence = useCallback((text: string): void => {
    // Simple heuristics to estimate confidence:
    // 1. Very short transcripts are often errors
    // 2. Transcripts with many filler words might be low confidence
    // 3. Transcripts with unusual punctuation patterns might be errors
    
    const fillerWords = ['um', 'uh', 'like', 'you know', 'sort of', 'kind of'];
    const hasFillerWords = fillerWords.some(word => text.toLowerCase().includes(word));
    
    const unusualPunctuation = /[?!.,]{2,}|[?!.,]{1}[a-zA-Z]/g;
    const hasUnusualPunctuation = unusualPunctuation.test(text);
    
    const wordCount = text.split(/\s+/).length;
    
    if (wordCount < 2 || hasUnusualPunctuation) {
      setConfidence(TranscriptConfidence.LOW);
    } else if (hasFillerWords || wordCount < 4) {
      setConfidence(TranscriptConfidence.MEDIUM);
    } else {
      setConfidence(TranscriptConfidence.HIGH);
    }
    
    console.log('Estimated confidence:', {
      text,
      wordCount,
      hasFillerWords,
      hasUnusualPunctuation,
      confidence: wordCount < 2 || hasUnusualPunctuation 
        ? 'LOW' 
        : (hasFillerWords || wordCount < 4 ? 'MEDIUM' : 'HIGH')
    });
  }, []);

  /**
   * Request microphone permissions explicitly
   * This function must be called directly from a user action to ensure the permission prompt appears
   */
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      console.log('Explicitly requesting microphone permission...');
      setErrorMessage(null);
      
      // Request access to the microphone - this MUST be triggered by a user action
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false 
      });
      
      // If we get here, permission was granted
      console.log('Microphone permission granted');
      setMicPermission('granted');
      
      // Stop all tracks to release the microphone
      // (SpeechRecognition will request it again when needed)
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error: any) {
      console.error('Error requesting microphone permission:', error);
      setMicPermission('denied');
      
      // Set specific error message based on error type
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access was denied. Please allow microphone access in your browser settings.');
      } else if (error.name === 'NotFoundError') {
        setErrorMessage('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'SecurityError') {
        setErrorMessage('Security error when accessing microphone. Try using HTTPS.');
      } else if (error.name === 'AbortError') {
        setErrorMessage('Microphone access request was aborted.');
      } else {
        setErrorMessage(`Microphone error: ${error.message || 'Unknown error'}`);
      }
      
      setStatus(RecognitionStatus.ERROR);
      return false;
    }
  }, []);

  /**
   * Force start listening - tries multiple approaches to ensure speech recognition starts
   * This is a more aggressive approach when normal startListening fails
   */
  const forceStartListening = useCallback(() => {
    try {
      console.log('Force starting speech recognition...');
      
      // Try to directly create and start a SpeechRecognition instance
      if (window.SpeechRecognition || window.webkitSpeechRecognition) {
        // Use the library's method first
        SpeechRecognition.startListening({ 
          continuous: isContinuousMode.current,
          language: 'en-US'
        });
        
        console.log('Force started listening using SpeechRecognition.startListening');
      }
    } catch (error) {
      console.error('Error in force start listening:', error);
      setErrorMessage('Failed to start speech recognition. Please try again.');
      isStartingListening.current = false;
      setStatus(RecognitionStatus.ERROR);
    }
  }, []);

  /**
   * Start listening for voice input
   * Explicitly requests microphone permission first
   */
  const startListening = useCallback(async () => {
    // Reset states
    resetTranscript();
    setEditableTranscript('');
    rawTranscriptRef.current = '';
    setErrorMessage(null);
    
    // Set flag that we're trying to start listening
    isStartingListening.current = true;
    retryAttempts.current = 0;
    
    try {
      // Check browser support first
      if (!browserSupportsSpeechRecognition) {
        throw new Error('Speech recognition is not supported in this browser');
      }
      
      // Check if we already have permission
      let permissionGranted = false;
      
      if (micPermission === 'granted') {
        permissionGranted = true;
      } else {
        // Request microphone permission - this must be from a user action
        permissionGranted = await requestMicrophonePermission();
      }
      
      if (!permissionGranted) {
        throw new Error('Microphone permission denied');
      }
      
      // Set status to listening - this will be corrected if listening doesn't actually start
      setStatus(RecognitionStatus.LISTENING);
      
      // Add a small delay after permission is granted before starting recognition
      // This helps ensure the browser has fully processed the permission
      console.log('Permission granted, starting speech recognition after short delay...');
      setTimeout(() => {
        // Configure speech recognition options
        console.log('Starting speech recognition with options:', {
          continuous: isContinuousMode.current,
          language: 'en-US'
        });
        
        try {
          // Start listening with specified options
          SpeechRecognition.startListening({ 
            continuous: isContinuousMode.current,
            language: 'en-US'
          });
          
          console.log('SpeechRecognition.startListening called successfully');
          
          // Check if listening actually started after a short delay
          setTimeout(() => {
            if (!listening) {
              console.log('Listening did not start after initial attempt, trying force start...');
              forceStartListening();
            } else {
              console.log('Listening confirmed active');
            }
          }, 300);
        } catch (startError) {
          console.error('Error starting speech recognition:', startError);
          // Try the force start approach
          console.log('Error in standard start, trying force start...');
          forceStartListening();
        }
      }, 200); // Short delay before starting
    } catch (error) {
      console.error('Error in startListening:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start voice recognition');
      setStatus(RecognitionStatus.ERROR);
      isStartingListening.current = false;
    }
  }, [browserSupportsSpeechRecognition, forceStartListening, listening, micPermission, requestMicrophonePermission, resetTranscript]);

  /**
   * Stop listening for voice input
   */
  const stopListening = useCallback(() => {
    console.log('Stopping voice recognition...');
    
    try {
      // Reset the starting flag since we're explicitly stopping
      isStartingListening.current = false;
      retryAttempts.current = 0;
      
      SpeechRecognition.stopListening();
      
      if (silenceTimer.current) {
        window.clearTimeout(silenceTimer.current);
        silenceTimer.current = null;
      }
      
      if (transcript || rawTranscriptRef.current) {
        setStatus(RecognitionStatus.PROCESSING);
        console.log('Processing final transcript:', transcript || rawTranscriptRef.current);
      } else {
        setStatus(RecognitionStatus.INACTIVE);
        console.log('No transcript to process, setting to inactive');
      }
      
      console.log('Stopped listening for voice input');
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
      setErrorMessage('Error stopping voice recognition');
      setStatus(RecognitionStatus.ERROR);
    }
  }, [transcript]);

  /**
   * Toggle listening state
   */
  const toggleListening = useCallback(async () => {
    console.log('Toggling listening state, current state:', listening);
    
    if (listening) {
      stopListening();
    } else {
      // This will trigger the permission request if needed
      await startListening();
    }
  }, [listening, startListening, stopListening]);

  /**
   * Confirm the current transcript and return it
   * This is used when the user is satisfied with the transcript
   */
  const confirmTranscript = useCallback((): string => {
    // Return the editable transcript (which might have been corrected by the user)
    const confirmedTranscript = editableTranscript || rawTranscriptRef.current;
    
    console.log('Confirming transcript:', confirmedTranscript);
    
    // Reset states
    resetTranscript();
    setEditableTranscript('');
    rawTranscriptRef.current = '';
    setStatus(RecognitionStatus.INACTIVE);
    
    return confirmedTranscript;
  }, [editableTranscript, resetTranscript]);

  /**
   * Update the editable transcript
   * This is used when the user edits a low confidence transcript
   */
  const updateTranscript = useCallback((newTranscript: string): void => {
    console.log('Updating transcript:', newTranscript);
    setEditableTranscript(newTranscript);
  }, []);

  // Setup event listeners for SpeechRecognition events
  useEffect(() => {
    if (!browserSupportsSpeechRecognition) return;
    
    const handleSpeechRecognitionError = (event: any) => {
      console.error('SpeechRecognition error:', event);
      
      // Handle specific error types
      let errorMsg = `Speech recognition error: ${event.error}`;
      
      switch (event.error) {
        case 'not-allowed':
        case 'permission-denied':
          errorMsg = 'Microphone access was denied. Please allow microphone access in your browser settings.';
          setMicPermission('denied');
          break;
        case 'no-speech':
          errorMsg = 'No speech detected. Please try speaking more clearly.';
          break;
        case 'audio-capture':
          errorMsg = 'No microphone detected. Please connect a microphone and try again.';
          break;
        case 'network':
          errorMsg = 'Network error occurred during speech recognition.';
          break;
        case 'aborted':
          errorMsg = 'Speech recognition was aborted.';
          break;
        case 'language-not-supported':
          errorMsg = 'The selected language is not supported.';
          break;
        case 'service-not-allowed':
          errorMsg = 'Speech recognition service is not allowed.';
          break;
      }
      
      setErrorMessage(errorMsg);
      setStatus(RecognitionStatus.ERROR);
      isStartingListening.current = false;
    };
    
    // Add event listeners if possible
    try {
      if (window.SpeechRecognition) {
        const recognition = new window.SpeechRecognition();
        recognition.onerror = handleSpeechRecognitionError;
        recognition.onstart = () => console.log('Native SpeechRecognition onstart event fired');
        recognition.onend = () => console.log('Native SpeechRecognition onend event fired');
      } else if (window.webkitSpeechRecognition) {
        const recognition = new window.webkitSpeechRecognition();
        recognition.onerror = handleSpeechRecognitionError;
        recognition.onstart = () => console.log('Native webkitSpeechRecognition onstart event fired');
        recognition.onend = () => console.log('Native webkitSpeechRecognition onend event fired');
      }
      
      console.log('SpeechRecognition event listeners set up');
    } catch (error) {
      console.error('Error setting up SpeechRecognition event listeners:', error);
    }
  }, [browserSupportsSpeechRecognition]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (silenceTimer.current) {
        window.clearTimeout(silenceTimer.current);
      }
      
      if (listening) {
        SpeechRecognition.stopListening();
      }
      
      console.log('Voice recognition hook cleaned up');
    };
  }, [listening]);

  return {
    transcript: editableTranscript || rawTranscriptRef.current,
    isListening: listening,
    status,
    confidence,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript: () => {
      resetTranscript();
      setEditableTranscript('');
      rawTranscriptRef.current = '';
    },
    confirmTranscript,
    updateTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
    errorMessage
  };
};

// Add type definitions to window object for TypeScript
declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
    SpeechGrammarList?: any;
    webkitSpeechGrammarList?: any;
    SpeechRecognitionEvent?: any;
    webkitSpeechRecognitionEvent?: any;
  }
}

export default useVoiceRecognition;
