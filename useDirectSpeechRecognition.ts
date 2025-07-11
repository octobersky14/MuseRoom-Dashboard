import { useState, useEffect, useCallback, useRef } from "react";

// Define confidence levels for transcription
export enum TranscriptConfidence {
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

// Define recognition status states
export enum RecognitionStatus {
  INACTIVE = "inactive",
  LISTENING = "listening",
  PROCESSING = "processing",
  ERROR = "error",
}

// Interface for the hook return value
export interface DirectSpeechRecognitionHook {
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

/**
 * Custom hook for direct speech recognition using the browser's native API
 * Bypasses the react-speech-recognition library for better reliability
 */
const useDirectSpeechRecognition = (): DirectSpeechRecognitionHook => {
  // State for transcript
  const [transcript, setTranscript] = useState<string>("");

  // State for listening status
  const [isListening, setIsListening] = useState<boolean>(false);

  // State for recognition status
  const [status, setStatus] = useState<RecognitionStatus>(
    RecognitionStatus.INACTIVE
  );

  // State for transcript confidence
  const [confidence, setConfidence] = useState<TranscriptConfidence>(
    TranscriptConfidence.HIGH
  );

  // State for editable transcript (for low confidence cases)
  const [editableTranscript, setEditableTranscript] = useState<string>("");

  // State for error message
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State for microphone permission
  const [micPermission, setMicPermission] = useState<
    "granted" | "denied" | "prompt" | "unknown"
  >("unknown");

  // State for browser support
  const [
    browserSupportsSpeechRecognition,
    setBrowserSupportsSpeechRecognition,
  ] = useState<boolean>(false);

  // State for microphone availability
  const [isMicrophoneAvailable, setIsMicrophoneAvailable] = useState<
    boolean | null
  >(null);

  // Reference to the SpeechRecognition instance
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Ref to track silence duration
  const silenceTimer = useRef<number | null>(null);

  // Ref to track if we're in continuous mode
  const isContinuousMode = useRef<boolean>(true);

  // Ref to track raw transcript from recognition
  const rawTranscriptRef = useRef<string>("");

  // Ref to track if recognition is being initialized
  const isInitializingRef = useRef<boolean>(false);

  // Ref to track recognition attempts
  const recognitionAttemptsRef = useRef<number>(0);
  const maxRecognitionAttempts = 3;

  /**
   * Initialize the SpeechRecognition API
   */
  const initSpeechRecognition = useCallback(() => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    try {
      // Check if the browser supports the Web Speech API
      if (typeof window !== "undefined") {
        window.SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        window.SpeechGrammarList =
          window.SpeechGrammarList || window.webkitSpeechGrammarList;
        window.SpeechRecognitionEvent =
          window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;

        const isSupported = !!window.SpeechRecognition;
        setBrowserSupportsSpeechRecognition(isSupported);

        console.log("SpeechRecognition initialized with:", {
          SpeechRecognition: !!window.SpeechRecognition,
          webkitSpeechRecognition: !!window.webkitSpeechRecognition,
        });

        if (!isSupported) {
          setErrorMessage("Your browser does not support speech recognition.");
          setStatus(RecognitionStatus.ERROR);
        }
      } else {
        setBrowserSupportsSpeechRecognition(false);
        setErrorMessage("Browser environment not available.");
        setStatus(RecognitionStatus.ERROR);
      }
    } catch (error) {
      console.error("Error initializing SpeechRecognition:", error);
      setBrowserSupportsSpeechRecognition(false);
      setErrorMessage("Failed to initialize speech recognition.");
      setStatus(RecognitionStatus.ERROR);
    } finally {
      isInitializingRef.current = false;
    }
  }, []);

  /**
   * Create a new SpeechRecognition instance with event handlers
   */
  const createRecognitionInstance = useCallback(() => {
    if (!window.SpeechRecognition) return null;

    try {
      // Create a new instance
      const recognition = new window.SpeechRecognition();

      // Configure the recognition
      recognition.continuous = isContinuousMode.current;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      // Set up event handlers
      recognition.onstart = () => {
        console.log("SpeechRecognition.onstart event fired");
        setIsListening(true);
        setStatus(RecognitionStatus.LISTENING);
        recognitionAttemptsRef.current = 0;
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("SpeechRecognition error:", event.error);

        // Handle specific error types
        let errorMsg: string | null = null;
        let shouldShowError = true;

        switch (event.error) {
          case "not-allowed":
          case "permission-denied":
            errorMsg =
              "Microphone access was denied. Please allow microphone access in your browser settings.";
            setMicPermission("denied");
            setIsMicrophoneAvailable(false);
            break;
          case "no-speech":
            // Don't show error for no-speech, it's expected behavior
            shouldShowError = false;
            break;
          case "audio-capture":
            errorMsg =
              "No microphone detected. Please connect a microphone and try again.";
            setIsMicrophoneAvailable(false);
            break;
          case "network":
            errorMsg = "Network error occurred during speech recognition.";
            break;
          case "aborted":
            // Don't show error for aborted, it's usually due to rapid clicking or normal stopping
            shouldShowError = false;
            console.log(
              "Speech recognition was aborted (this is usually normal)"
            );
            break;
          case "language-not-supported":
            errorMsg = "The selected language is not supported.";
            break;
          case "service-not-allowed":
            errorMsg = "Speech recognition service is not allowed.";
            break;
          default:
            errorMsg = `Speech recognition error: ${event.error}`;
            break;
        }

        // Only set error message for serious errors
        if (shouldShowError && errorMsg) {
          setErrorMessage(errorMsg);
        }

        setIsListening(false);

        // Only set error status if it's a fatal error
        if (event.error !== "no-speech" && event.error !== "aborted") {
          setStatus(RecognitionStatus.ERROR);
        } else {
          setStatus(RecognitionStatus.INACTIVE);
        }
      };

      recognition.onend = () => {
        console.log("SpeechRecognition.onend event fired");
        setIsListening(false);

        // If we have a transcript, set to processing
        if (transcript || rawTranscriptRef.current) {
          setStatus(RecognitionStatus.PROCESSING);
        } else if (status !== RecognitionStatus.ERROR) {
          setStatus(RecognitionStatus.INACTIVE);
        }
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        let interimTranscript = "";

        // Process all results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;

          if (result.isFinal) {
            finalTranscript += text;
            console.log(
              "Final transcript:",
              text,
              "Confidence:",
              result[0].confidence
            );
          } else {
            interimTranscript += text;
          }
        }

        // Update transcript if we have final or interim results
        if (finalTranscript) {
          rawTranscriptRef.current = finalTranscript;
          setTranscript(finalTranscript);
          setEditableTranscript(finalTranscript);
          estimateConfidence(finalTranscript);
        } else if (interimTranscript) {
          // Only update for significant changes to avoid unnecessary re-renders
          if (
            interimTranscript.length > 3 &&
            interimTranscript !== transcript
          ) {
            setTranscript(interimTranscript);
          }
        }
      };

      return recognition;
    } catch (error) {
      console.error("Error creating SpeechRecognition instance:", error);
      setErrorMessage("Failed to create speech recognition instance.");
      setStatus(RecognitionStatus.ERROR);
      return null;
    }
  }, [transcript, status]);

  /**
   * Check for microphone permissions
   */
  const checkMicrophonePermission = useCallback(async () => {
    try {
      if (navigator.permissions) {
        const permissionStatus = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        setMicPermission(
          permissionStatus.state as "granted" | "denied" | "prompt"
        );

        console.log(
          "Initial microphone permission state:",
          permissionStatus.state
        );

        // Listen for permission changes
        permissionStatus.onchange = () => {
          console.log(
            "Microphone permission changed to:",
            permissionStatus.state
          );
          setMicPermission(
            permissionStatus.state as "granted" | "denied" | "prompt"
          );

          if (permissionStatus.state === "granted") {
            setErrorMessage(null);
            setIsMicrophoneAvailable(true);
          } else if (permissionStatus.state === "denied") {
            setErrorMessage(
              "Microphone access was denied. Please allow microphone access in your browser settings."
            );
            setStatus(RecognitionStatus.ERROR);
            setIsMicrophoneAvailable(false);
          }
        };

        // Set microphone availability based on permission
        if (permissionStatus.state === "granted") {
          setIsMicrophoneAvailable(true);
        } else if (permissionStatus.state === "denied") {
          setIsMicrophoneAvailable(false);
        }
      } else {
        console.log(
          "Permissions API not supported, will request permissions when needed"
        );

        // Try to access the microphone to check if it's available
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          stream.getTracks().forEach((track) => track.stop());
          setIsMicrophoneAvailable(true);
          setMicPermission("granted");
        } catch (error) {
          console.log("Microphone not available or permission denied");
          setIsMicrophoneAvailable(false);
          setMicPermission("denied");
        }
      }
    } catch (error) {
      console.error("Error checking microphone permission:", error);
      setIsMicrophoneAvailable(null);
    }
  }, []);

  /**
   * Request microphone permissions explicitly
   */
  const requestMicrophonePermission =
    useCallback(async (): Promise<boolean> => {
      try {
        console.log("Explicitly requesting microphone permission...");
        setErrorMessage(null);

        // Request access to the microphone - this MUST be triggered by a user action
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        // If we get here, permission was granted
        console.log("Microphone permission granted");
        setMicPermission("granted");
        setIsMicrophoneAvailable(true);

        // Stop all tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop());

        return true;
      } catch (error: any) {
        console.error("Error requesting microphone permission:", error);
        setMicPermission("denied");
        setIsMicrophoneAvailable(false);

        // Set specific error message based on error type
        if (
          error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError"
        ) {
          setErrorMessage(
            "Microphone access was denied. Please allow microphone access in your browser settings."
          );
        } else if (error.name === "NotFoundError") {
          setErrorMessage(
            "No microphone found. Please connect a microphone and try again."
          );
        } else if (error.name === "SecurityError") {
          setErrorMessage(
            "Security error when accessing microphone. Try using HTTPS."
          );
        } else if (error.name === "AbortError") {
          setErrorMessage("Microphone access request was aborted.");
        } else {
          setErrorMessage(
            `Microphone error: ${error.message || "Unknown error"}`
          );
        }

        setStatus(RecognitionStatus.ERROR);
        return false;
      }
    }, []);

  /**
   * Estimate confidence level based on transcript characteristics
   */
  const estimateConfidence = useCallback((text: string): void => {
    // Simple heuristics to estimate confidence:
    // 1. Very short transcripts are often errors
    // 2. Transcripts with many filler words might be low confidence
    // 3. Transcripts with unusual punctuation patterns might be errors

    const fillerWords = ["um", "uh", "like", "you know", "sort of", "kind of"];
    const hasFillerWords = fillerWords.some((word) =>
      text.toLowerCase().includes(word)
    );

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

    console.log("Estimated confidence:", {
      text,
      wordCount,
      hasFillerWords,
      hasUnusualPunctuation,
      confidence:
        wordCount < 2 || hasUnusualPunctuation
          ? "LOW"
          : hasFillerWords || wordCount < 4
          ? "MEDIUM"
          : "HIGH",
    });
  }, []);

  /**
   * Start listening for voice input
   */
  const startListening = useCallback(async () => {
    // Reset states
    setTranscript("");
    setEditableTranscript("");
    rawTranscriptRef.current = "";
    setErrorMessage(null);

    try {
      // Check browser support first
      if (!browserSupportsSpeechRecognition) {
        throw new Error("Speech recognition is not supported in this browser");
      }

      // Check if we already have permission
      let permissionGranted = false;

      if (micPermission === "granted") {
        permissionGranted = true;
      } else {
        // Request microphone permission - this must be from a user action
        permissionGranted = await requestMicrophonePermission();
      }

      if (!permissionGranted) {
        throw new Error("Microphone permission denied");
      }

      // Create a new recognition instance
      if (!recognitionRef.current) {
        recognitionRef.current = createRecognitionInstance();
      }

      if (!recognitionRef.current) {
        throw new Error("Failed to create speech recognition instance");
      }

      // Set status to listening
      setStatus(RecognitionStatus.LISTENING);

      // Clear any existing silence timer
      if (silenceTimer.current) {
        window.clearTimeout(silenceTimer.current);
      }

      // Set up silence detection
      silenceTimer.current = window.setTimeout(() => {
        // If we're still listening after silence period, stop
        if (isListening) {
          console.log("Silence detected, stopping listening");
          stopListening();
        }
      }, 5000); // 5 seconds of silence will trigger a stop

      // Start recognition
      console.log("Starting speech recognition...");
      recognitionRef.current.start();

      // Check if recognition actually started after a short delay
      setTimeout(() => {
        if (
          !isListening &&
          recognitionAttemptsRef.current < maxRecognitionAttempts
        ) {
          console.log(
            `Recognition didn't start, retrying (attempt ${
              recognitionAttemptsRef.current + 1
            }/${maxRecognitionAttempts})`
          );
          recognitionAttemptsRef.current++;

          // Recreate the recognition instance
          if (recognitionRef.current) {
            try {
              recognitionRef.current.abort();
            } catch (e) {
              console.error("Error aborting previous recognition:", e);
            }
          }

          recognitionRef.current = createRecognitionInstance();

          if (recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error("Error starting recognition on retry:", e);
            }
          }
        }
      }, 500);
    } catch (error) {
      console.error("Error starting voice recognition:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to start voice recognition"
      );
      setStatus(RecognitionStatus.ERROR);
    }
  }, [
    browserSupportsSpeechRecognition,
    createRecognitionInstance,
    isListening,
    micPermission,
    requestMicrophonePermission,
  ]);

  /**
   * Stop listening for voice input
   */
  const stopListening = useCallback(() => {
    console.log("Stopping voice recognition...");

    try {
      // Clear silence timer
      if (silenceTimer.current) {
        window.clearTimeout(silenceTimer.current);
        silenceTimer.current = null;
      }

      // Stop recognition if it exists
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error("Error stopping recognition:", error);
          // Try to abort if stop fails
          try {
            recognitionRef.current.abort();
          } catch (abortError) {
            console.error("Error aborting recognition:", abortError);
          }
        }
      }

      // Update state even if the above fails
      setIsListening(false);

      // If we have a transcript, set to processing
      if (transcript || rawTranscriptRef.current) {
        setStatus(RecognitionStatus.PROCESSING);
      } else if (status !== RecognitionStatus.ERROR) {
        setStatus(RecognitionStatus.INACTIVE);
      }
    } catch (error) {
      console.error("Error in stopListening:", error);
      setErrorMessage("Error stopping voice recognition");
      setStatus(RecognitionStatus.ERROR);
    }
  }, [transcript, status]);

  /**
   * Toggle listening state
   */
  const toggleListening = useCallback(() => {
    console.log("Toggling listening state, current state:", isListening);

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  /**
   * Reset transcript
   */
  const resetTranscript = useCallback(() => {
    setTranscript("");
    setEditableTranscript("");
    rawTranscriptRef.current = "";
  }, []);

  /**
   * Confirm the current transcript and return it
   */
  const confirmTranscript = useCallback((): string => {
    // Return the editable transcript (which might have been corrected by the user)
    const confirmedTranscript =
      editableTranscript || transcript || rawTranscriptRef.current;

    console.log("Confirming transcript:", confirmedTranscript);

    // Reset states
    resetTranscript();
    setStatus(RecognitionStatus.INACTIVE);

    return confirmedTranscript;
  }, [editableTranscript, transcript, resetTranscript]);

  /**
   * Update the editable transcript
   */
  const updateTranscript = useCallback((newTranscript: string): void => {
    console.log("Updating transcript:", newTranscript);
    setEditableTranscript(newTranscript);
  }, []);

  // Initialize on mount
  useEffect(() => {
    initSpeechRecognition();
    checkMicrophonePermission();

    // Clean up on unmount
    return () => {
      if (silenceTimer.current) {
        window.clearTimeout(silenceTimer.current);
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (error) {
          console.error("Error aborting recognition on unmount:", error);
        }
      }

      console.log("Direct speech recognition hook cleaned up");
    };
  }, [initSpeechRecognition, checkMicrophonePermission]);

  return {
    transcript: editableTranscript || transcript || rawTranscriptRef.current,
    isListening,
    status,
    confidence,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    confirmTranscript,
    updateTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
    errorMessage,
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

export default useDirectSpeechRecognition;
