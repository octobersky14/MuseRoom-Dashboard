import React, { useState, useRef, useEffect } from "react";
import { getGeminiResponse } from "../geminiApi";
import { useVoiceAssistant } from "../../useVoiceAssistant";

const MEDITATION_MUSIC_SRC = "/meditation-music.mp3";
const ASSISTANT_PERSONA =
  "You are Muse, a mindful, gentle, and empathetic AI meditation guide. Speak warmly, calmly, and conversationally, as if you are a caring human companion. Your voice is slow, smooth, and deep, with a soothing, meditative tone.";
const INITIAL_PROMPT = `${ASSISTANT_PERSONA} Begin a 5-minute guided relaxation meditation. Do not introduce yourself or greet the user. Guide the user with the first step only. Make your language slow, reflective, and leave space for silence.`;
const SESSION_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const PAUSE_BETWEEN_STEPS_MS = 25000; // 25 seconds
const CLOSING_MESSAGE =
  "Your meditation is complete. Take a moment to notice how you feel, and gently open your eyes when you're ready. Muse is always here for you.";

interface MeditationGuideProps {
  elevenLabsApiKey?: string;
  selectedVoice?: string;
  userContext?: any; // For future user preferences/memory
  stopMeditation?: () => void;
}

// Session persistence keys
const SESSION_STORAGE_KEY = "museroom_meditation_session";

const MeditationGuide: React.FC<MeditationGuideProps> = ({
  elevenLabsApiKey = "",
  selectedVoice = "JBFqnCBsd6RMkjVDRZzb", // Default voice
  userContext = {},
  stopMeditation,
}) => {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [steps, setSteps] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [resumeData, setResumeData] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const stopRequestedRef = useRef(false);

  // Make meditation music quieter
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.2;
    }
  }, []);

  // ElevenLabs TTS via useVoiceAssistant
  const voiceAssistant = useVoiceAssistant({
    enabled: true,
    muted: false,
    elevenLabsApiKey,
    elevenLabsVoiceId: selectedVoice,
    onSpeakingChange: (speaking) => setIsSpeaking(speaking),
    // voiceSettings: { ... } // removed for now, not supported in hook
  });

  // Check for saved session on mount
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data && data.steps && data.elapsed != null && !data.sessionDone) {
          setResumeAvailable(true);
          setResumeData(data);
        }
      } catch {}
    }
  }, []);

  // Track elapsed time
  useEffect(() => {
    if (!started || sessionDone) return;
    sessionStartRef.current = Date.now() - elapsed;
    setElapsed(elapsed); // keep current elapsed
    const interval = setInterval(() => {
      if (sessionStartRef.current) {
        setElapsed(Date.now() - sessionStartRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [started, sessionDone]);

  // Save session to localStorage
  const saveSession = (data: any) => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  };
  // Clear session from localStorage
  const clearSession = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setResumeAvailable(false);
    setResumeData(null);
  };

  // Start meditation: play music and get first step
  const startMeditation = async (fromResume = false) => {
    stopRequestedRef.current = false;
    setStarted(true);
    setSessionDone(false);
    if (fromResume && resumeData) {
      setSteps(resumeData.steps);
      setStep(resumeData.step);
      setElapsed(resumeData.elapsed);
    } else {
      setSteps([]);
      setStep(0);
      setElapsed(0);
    }
    sessionStartRef.current =
      Date.now() - (fromResume && resumeData ? resumeData.elapsed : 0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
    await runMeditation(fromResume);
  };

  // Main meditation loop
  const runMeditation = async (fromResume = false) => {
    let running = true;
    let currentStep = fromResume && resumeData ? resumeData.step : 0;
    let currentSteps: string[] =
      fromResume && resumeData ? [...resumeData.steps] : [];
    let lastPrompt =
      fromResume && resumeData && resumeData.lastPrompt
        ? resumeData.lastPrompt
        : INITIAL_PROMPT;
    const startTime =
      Date.now() - (fromResume && resumeData ? resumeData.elapsed : 0);
    while (running) {
      if (stopRequestedRef.current) {
        // Save session state for resume
        saveSession({
          steps: currentSteps,
          step: currentStep,
          elapsed: Date.now() - startTime,
          lastPrompt,
          sessionDone: false,
        });
        setStarted(false);
        setSessionDone(false);
        setResumeAvailable(true);
        setResumeData({
          steps: currentSteps,
          step: currentStep,
          elapsed: Date.now() - startTime,
          lastPrompt,
          sessionDone: false,
        });
        return;
      }
      setLoading(true);
      const response = await getGeminiResponse(lastPrompt);
      currentSteps = [...currentSteps, response];
      setSteps([...currentSteps]);
      setStep(currentStep + 1);
      setLoading(false);
      setIsSpeaking(true);
      await voiceAssistant.speak(response);
      setIsSpeaking(false);
      // Check if session time is up
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs >= SESSION_DURATION_MS) {
        running = false;
        break;
      }
      // Wait pause before next step
      await new Promise((res) => setTimeout(res, PAUSE_BETWEEN_STEPS_MS));
      lastPrompt = `${ASSISTANT_PERSONA} Continue the meditation. Do not introduce yourself or greet the user. Make your language slow, reflective, and leave space for silence. Give the next step only, after: "${response}"`;
      currentStep++;
    }
    // Closing message
    setSessionDone(true);
    setLoading(true);
    setSteps((prev) => [...prev, CLOSING_MESSAGE]);
    setStep((prev) => prev + 1);
    await voiceAssistant.speak(CLOSING_MESSAGE);
    setLoading(false);
    clearSession();
  };

  // Stop meditation early (user action)
  const handleStop = () => {
    stopRequestedRef.current = true;
    if (stopMeditation) stopMeditation();
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/80 to-pink-900/80 text-white">
      {/* Visible audio player for debugging music playback */}
      <audio
        ref={audioRef}
        src={MEDITATION_MUSIC_SRC}
        loop
        autoPlay={false}
        preload="auto"
        controls
        style={{ marginBottom: 24 }}
      />
      {!started ? (
        <div className="flex flex-col items-center gap-8">
          <h1 className="text-4xl font-bold mb-4">Guided Meditation</h1>
          <p className="text-lg mb-6 max-w-xl text-center opacity-80">
            Find a comfortable place to sit or lie down. When you’re ready,
            click below, close your eyes, and follow the guided meditation.
          </p>
          {resumeAvailable && (
            <div className="flex flex-col gap-2 mb-4">
              <button
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-400 text-white text-lg font-semibold shadow hover:scale-105 transition-all"
                onClick={() => startMeditation(true)}
              >
                Resume Meditation
              </button>
              <button
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-gray-700 to-gray-500 text-white text-lg font-semibold shadow hover:scale-105 transition-all"
                onClick={() => {
                  clearSession();
                  startMeditation(false);
                }}
              >
                Start from Beginning
              </button>
            </div>
          )}
          {!resumeAvailable && (
            <button
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xl font-semibold shadow-lg hover:scale-105 transition-all"
              onClick={() => startMeditation(false)}
            >
              Start Meditation
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
          <h2 className="text-3xl font-semibold mb-2">
            Close your eyes and listen…
          </h2>
          <div className="bg-black/40 rounded-2xl p-8 shadow-xl w-full flex flex-col items-center">
            <div className="text-lg mb-6 max-w-xl text-center opacity-80 min-h-[4rem]">
              Meditation in progress…
            </div>
            <div className="mt-4 text-sm opacity-70">
              {sessionDone
                ? "Session complete."
                : `Elapsed: ${Math.floor(elapsed / 60000)}:${String(
                    Math.floor((elapsed % 60000) / 1000)
                  ).padStart(2, "0")}`}
            </div>
            {loading && !sessionDone && (
              <div className="mt-4 text-pink-300 animate-pulse">
                Loading next step…
              </div>
            )}
            {!sessionDone && (
              <button
                className="mt-8 px-6 py-2 rounded-lg bg-gradient-to-r from-gray-700 to-gray-500 text-white text-base font-semibold shadow hover:scale-105 transition-all"
                onClick={handleStop}
                disabled={loading || isSpeaking}
              >
                Stop Meditation
              </button>
            )}
          </div>
          <p className="mt-8 text-sm opacity-60">
            Music will continue in the background. You can pause or stop it at
            any time using your system controls.
          </p>
        </div>
      )}
    </div>
  );
};

export default MeditationGuide;
