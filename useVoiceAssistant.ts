import { useEffect, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
    __GLOBAL_TTS_CTRL?: {
      queue: Array<{ text: string; agentId: string }>;
      isPlaying: boolean;
    };
    __VOICE_ENABLED?: boolean;
    /**
     * Holds a reference to the currently-active voice assistant instance.  If a second
     * instance attempts to mount we will call `stop()` on the previous instance so that
     * there is never more than one active at the same time.
     */
    __VOICE_ASSISTANT_INSTANCE__?: {
      agentId: string;
      stop: () => void;
    };
  }
}

if (typeof window !== "undefined" && !window.__GLOBAL_TTS_CTRL) {
  window.__GLOBAL_TTS_CTRL = { queue: [], isPlaying: false };
}

interface UseVoiceAssistantOptions {
  enabled: boolean;
  onTranscript?: (text: string) => void; // Called when user finishes speaking
  circleElementRef?: React.RefObject<HTMLElement | null> | null; // Orb element ref to scale
  muted: boolean;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string; // defaults to supported voice id
  waveformCanvas?: HTMLCanvasElement | null; // canvas for waveform
  onSpeakingChange?: (val: boolean) => void;
  onError?: (msg: string) => void;
}

/**
 * Hook that handles browser speech-to-text (Web Speech API) and ElevenLabs text-to-speech playback.
 * While ElevenLabs audio is playing, it measures volume using Web Audio API and scales the provided circle element.
 */
export function useVoiceAssistant({
  enabled,
  onTranscript,
  circleElementRef,
  muted,
  elevenLabsApiKey = "",
  elevenLabsVoiceId = "EXAVITQu4vr4xnSDxMaL", // default voice id from docs
  waveformCanvas,
  onSpeakingChange,
  onError,
}: UseVoiceAssistantOptions) {
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ttsAnalyserRef = useRef<AnalyserNode | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveformAnimIdRef = useRef<number | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const circleElRef = useRef<HTMLElement | null>(null);
  const isTtsPlayingRef = useRef(false);
  const agentIdRef = useRef<string>(
    `agent_${Math.random().toString(36).slice(2, 8)}`
  );
  const micActiveRef = useRef(false);
  const hasMountedRef = useRef(false);
  const restartInfoRef = useRef<{ count: number; ts: number }>({
    count: 0,
    ts: 0,
  });
  const canvasAnimIdRef = useRef<number | null>(null);
  const restAnimIdRef = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  const abortAllRef = useRef(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const log = (msg: string, ...extra: any[]) => {
    console.log(`[VoiceAssistant][${agentIdRef.current}] ${msg}`, ...extra);
  };

  // NEW: track option changes
  useEffect(() => {
    log(`OPTIONS_CHANGE enabled=${enabled} muted=${muted}`);
  }, [enabled, muted]);

  // keep ref in sync with latest element or when the DOM node mounts/changes
  useEffect(() => {
    circleElRef.current = circleElementRef?.current ?? null;
  }, [circleElementRef, circleElementRef?.current]);

  useEffect(() => {
    waveformCanvasRef.current = waveformCanvas ?? null;
  }, [waveformCanvas]);

  // helper to start scaling animation for an input source (mic only)
  const startAnalyserLoop = (source: AudioNode) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (!analyserRef.current) {
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 512; // smaller window for lower latency (~12ms at 44.1kHz)
      analyserRef.current.smoothingTimeConstant = 0.25; // lighter internal smoothing
    }

    // ensure only one connection from this source
    source.connect(analyserRef.current);

    const timeData = new Uint8Array(analyserRef.current.fftSize);
    let smoothedLevel = 0;

    const animate = () => {
      if (!analyserRef.current) return;
      if (isTtsPlayingRef.current) {
        animationIdRef.current = requestAnimationFrame(animate);
        return; // freeze while assistant is speaking
      }

      // Pull time-domain data and compute RMS volume (0..1)
      analyserRef.current.getByteTimeDomainData(timeData);
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const centered = timeData[i] - 128; // center around 0
        sumSq += centered * centered;
      }
      const rms = Math.sqrt(sumSq / timeData.length) / 128; // 0..1

      // exponential moving average for smoothness – tuned for snappier response
      const attack = 0.9; // very fast rise
      const release = 0.3; // moderate fall
      smoothedLevel =
        rms > smoothedLevel
          ? attack * rms + (1 - attack) * smoothedLevel
          : release * rms + (1 - release) * smoothedLevel;

      const orbEl =
        circleElRef.current ||
        document.querySelector(".ai-sidebar-container.circle-mode");
      if (orbEl) {
        const maxScale = 1.5; // cap at 50% growth
        // Boost perceived level – multiply by 3, then clamp to 1
        const displayLevel = Math.min(1, smoothedLevel * 3);
        const scale = 1 + displayLevel * (maxScale - 1);
        (orbEl as HTMLElement).style.setProperty(
          "--orb-scale",
          scale.toFixed(3)
        );
      }

      animationIdRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  const stopAnalyserLoop = () => {
    if (animationIdRef.current !== null)
      cancelAnimationFrame(animationIdRef.current);
    if (circleElRef.current) {
      circleElRef.current.style.setProperty("--orb-scale", "1");
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {}
      analyserRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  };

  // ----- Rest line animation -----
  const startRestLine = () => {
    if (!waveformCanvasRef.current) return;
    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width: cssW, height: cssH } = canvas.getBoundingClientRect();
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const drawW = canvas.width / dpr;
    const drawH = canvas.height / dpr;

    const glowW = drawW * 0.25;
    let pos = -glowW / 2; // start just off left edge
    const speed = drawW * 0.006; // moderate speed

    const animateGlow = () => {
      ctx.clearRect(0, 0, drawW, drawH);

      // base faint line – brighter
      ctx.strokeStyle = "rgba(0, 234, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, drawH / 2);
      ctx.lineTo(drawW, drawH / 2);
      ctx.stroke();

      const grad = ctx.createLinearGradient(
        pos - glowW / 2,
        0,
        pos + glowW / 2,
        0
      );
      grad.addColorStop(0, "rgba(0,234,255,0)");
      grad.addColorStop(0.5, "rgba(0,234,255,1)");
      grad.addColorStop(1, "rgba(0,234,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 6;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#00eaff";
      ctx.beginPath();
      ctx.moveTo(pos - glowW / 2, drawH / 2);
      ctx.lineTo(pos + glowW / 2, drawH / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      pos += speed;
      if (pos - glowW / 2 > drawW) {
        pos = -glowW / 2; // restart from left
      }

      restAnimIdRef.current = requestAnimationFrame(animateGlow);
    };

    // kick off
    animateGlow();
  };

  // canvas waveform visual like Siri
  const startWaveCanvas = (source: AudioNode) => {
    if (!waveformCanvasRef.current) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (!ttsAnalyserRef.current) {
      ttsAnalyserRef.current = audioCtxRef.current.createAnalyser();
      ttsAnalyserRef.current.fftSize = 1024;
      ttsAnalyserRef.current.smoothingTimeConstant = 0.8;
    }
    source.connect(ttsAnalyserRef.current);

    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // reset scale each resize
    };
    resize();
    const dataArray = new Uint8Array(ttsAnalyserRef.current.fftSize);

    // one buffer to keep smoothed values for fluid motion
    let smoothBuf: number[] = [];

    const animate = () => {
      if (!ttsAnalyserRef.current) return;
      ttsAnalyserRef.current.getByteTimeDomainData(dataArray);

      const drawW = canvas.width / dpr;
      const drawH = canvas.height / dpr;
      ctx.clearRect(0, 0, drawW, drawH);
      ctx.lineWidth = 2;
      const gradient = ctx.createLinearGradient(0, 0, drawW, 0);
      gradient.addColorStop(0, "#00eaff");
      gradient.addColorStop(1, "#ffffff");
      ctx.fillStyle = gradient;

      const midY = drawH / 2;
      const step = dataArray.length / drawW;

      // init smooth buffer if size changed
      if (smoothBuf.length !== Math.ceil(drawW)) {
        smoothBuf = new Array(Math.ceil(drawW)).fill(0);
      }

      const alpha = 0.07; // lower => smoother (slower)
      const ampScale = 1.4; // enlarge waveform visually

      ctx.beginPath();
      ctx.moveTo(0, midY);
      for (let x = 0; x < drawW; x++) {
        const idx = Math.floor(x * step);
        const v = (dataArray[idx] - 128) / 128; // -1..1 raw
        // exponential moving average
        smoothBuf[x] = smoothBuf[x] * (1 - alpha) + v * alpha;
        const y =
          midY + Math.max(-1, Math.min(1, smoothBuf[x] * ampScale)) * midY;
        ctx.lineTo(x, y);
      }
      for (let x = drawW - 1; x >= 0; x--) {
        const idx = Math.floor(x * step);
        const v = (dataArray[idx] - 128) / 128;
        smoothBuf[x] = smoothBuf[x] * (1 - alpha) + v * alpha;
        const y =
          midY - Math.max(-1, Math.min(1, smoothBuf[x] * ampScale)) * midY;
        ctx.lineTo(x, y);
      }
      ctx.closePath();

      // glowing fill
      ctx.save();
      ctx.shadowBlur = 35;
      ctx.shadowColor = "#00eaff";
      ctx.globalCompositeOperation = "lighter";
      ctx.fill();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();

      canvasAnimIdRef.current = requestAnimationFrame(animate);
    };
    animate();
    window.addEventListener("resize", resize);

    // stop any resting animation
    if (restAnimIdRef.current) {
      cancelAnimationFrame(restAnimIdRef.current);
      restAnimIdRef.current = null;
    }
  };

  const stopWaveCanvas = () => {
    if (canvasAnimIdRef.current) {
      cancelAnimationFrame(canvasAnimIdRef.current);
      canvasAnimIdRef.current = null;
    }

    // start rest glowing line
    startRestLine();

    if (ttsAnalyserRef.current) {
      ttsAnalyserRef.current.disconnect();
      ttsAnalyserRef.current = null;
    }
  };

  const startSpeechRecognition = () => {
    if ((window as any).electronVoice) {
      // Use native bridge in Electron
      (window as any).electronVoice.start();
      const detachResult = (window as any).electronVoice.onResult((text: string) => {
        log("RECOG_RESULT", text);
        onTranscript?.(text);
      });
      const detachErr = (window as any).electronVoice.onError((msg: string) => {
        setVoiceError(msg);
        onError?.(msg);
      });
      recognitionRef.current = { detachResult, detachErr, isElectronBridge: true } as any;
    } else {
      // fallback Web Speech (browser)
      const SpeechRecognitionImpl =
        (window as any).webkitSpeechRecognition ||
        (window as any).SpeechRecognition;
      if (!SpeechRecognitionImpl) {
        console.warn("SpeechRecognition API not supported");
        log("LISTENING_UNSUPPORTED_API");
        setVoiceError("Speech recognition is not supported in this browser.");
        onError?.("Speech recognition is not supported in this browser.");
        return;
      }
      if (recognitionRef.current) return; // already running
      const rec: any = new SpeechRecognitionImpl();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "en-US";
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        log("RECOG_RESULT", transcript);
        onTranscript?.(transcript);
      };
      rec.onerror = (e: any) => {
        console.error("Speech recognition error", e);
        log("RECOG_ERROR", e);
        if (e.error === "network") {
          setVoiceError(
            "Network error: Speech recognition requires an internet connection and may not work reliably on Chromium browsers (Arc, Chrome, Edge) on localhost. Try using Safari or check your connection."
          );
          onError?.(
            "Network error: Speech recognition requires an internet connection and may not work reliably on Chromium browsers (Arc, Chrome, Edge) on localhost. Try using Safari or check your connection."
          );
          abortAllRef.current = true;
          stopSpeechRecognition();
        }
      };
      rec.onend = () => {
        if (
          !abortAllRef.current &&
          enabledRef.current &&
          !muted &&
          !isTtsPlayingRef.current
        ) {
          const now = Date.now();
          if (now - restartInfoRef.current.ts > 3000) {
            restartInfoRef.current = { count: 1, ts: now };
          } else {
            restartInfoRef.current.count += 1;
          }
          if (restartInfoRef.current.count <= 5) {
            log("LISTENING_RESTART");
            rec.start();
          } else {
            log("LISTENING_RESTART_SUPPRESSED");
            setTimeout(() => {
              if (
                !abortAllRef.current &&
                enabledRef.current &&
                !muted &&
                !isTtsPlayingRef.current
              ) {
                restartInfoRef.current = { count: 0, ts: Date.now() };
                log("LISTENING_RESTART_AFTER_SUPPRESS");
                startSpeechRecognition();
              }
            }, 1500);
          }
        } else {
          log("LISTENING_STOP");
        }
      };
      rec.start();
      recognitionRef.current = rec;
      log("LISTENING_START");
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current?.isElectronBridge) {
      (window as any).electronVoice?.stop();
      recognitionRef.current.detachResult?.();
      recognitionRef.current.detachErr?.();
      recognitionRef.current = null;
      log("ELECTRON_LISTENING_STOP");
    } else if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
      log("LISTENING_FORCE_STOP");
    }
  };

  // Helper that guarantees we have a live mic MediaStream feeding the analyser
  const ensureMicAnalyser = async () => {
    if (!enabledRef.current || muted) return;
    const needsNewStream =
      !micStreamRef.current ||
      micStreamRef.current.getTracks().every((t) => t.readyState === "ended");
    if (!needsNewStream) return; // existing stream still good

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      micStreamRef.current = stream;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      if (audioCtxRef.current.state === "suspended")
        await audioCtxRef.current.resume().catch(() => {});

      const src = audioCtxRef.current.createMediaStreamSource(stream);
      startAnalyserLoop(src);
      micActiveRef.current = true;
      log("MIC_ANALYSER_RESTART");
    } catch (err) {
      console.warn("ensureMicAnalyser: getUserMedia failed", err);
    }
  };

  // Setup/teardown mic analyser separate from speech recognition
  useEffect(() => {
    if (enabled && !muted && !micActiveRef.current) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          log("MIC_PERMISSION_GRANTED");
          micActiveRef.current = true;
          if (micStreamRef.current) {
            stream.getTracks().forEach((t) => t.stop());
          }
          micStreamRef.current = stream;
          if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
          const micSource = audioCtxRef.current.createMediaStreamSource(stream);
          startAnalyserLoop(micSource);
          if (audioCtxRef.current.state === "suspended") {
            audioCtxRef.current.resume().catch(() => {});
          }
          log("MIC_ANALYSER_START");
          // kick off rest line immediately
          startRestLine();
        })
        .catch((err) => {
          console.warn("Mic getUserMedia failed", err);
          log("MIC_PERMISSION_DENIED", err);
        });
    }

    if ((!enabled || muted) && micActiveRef.current) {
      stopAnalyserLoop();
      micActiveRef.current = false;
      log("MIC_ANALYSER_STOP");
      // cancel rest animation
      if (restAnimIdRef.current) {
        cancelAnimationFrame(restAnimIdRef.current);
        restAnimIdRef.current = null;
      }
    }

    // On every re-run also verify that the stream is still alive; if not, try to revive.
    ensureMicAnalyser();

    return () => {
      stopAnalyserLoop();
      micActiveRef.current = false;
    };
  }, [enabled, muted]);

  // start speech recognition when enabled & not muted
  useEffect(() => {
    if (enabled && !muted) {
      startSpeechRecognition();
    } else {
      stopSpeechRecognition();
    }

    // Ignore cleanup during re-renders to avoid stopping TTS mid-playback.
    if (!hasMountedRef.current) {
      hasMountedRef.current = true; // first StrictMode test unmount
    }
  }, [enabled, muted]);

  const playText = async (text: string, agentId: string) => {
    try {
      stopSpeechRecognition(); // pause listening during TTS
      log(`TTS start for text length ${text.length}`);
      const resp = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": elevenLabsApiKey,
          },
          body: JSON.stringify({ text }),
        }
      );
      if (!resp.ok) throw new Error("ElevenLabs TTS failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      // Ensure AudioContext is running (some browsers start it suspended)
      if (audioCtxRef.current.state === "suspended") {
        try {
          await audioCtxRef.current.resume();
          log("AUDIO_CTX_RESUMED");
        } catch {
          log("AUDIO_CTX_RESUME_FAILED");
        }
      }
      const source = audioCtxRef.current.createMediaElementSource(audio);
      source.connect(audioCtxRef.current.destination);
      startWaveCanvas(source);
      currentAudioRef.current = audio;
      isTtsPlayingRef.current = true;
      onSpeakingChange?.(true);
      audio.onended = () => {
        isTtsPlayingRef.current = false;
        onSpeakingChange?.(false);
        log("TTS ended");
        URL.revokeObjectURL(url);
        playNext();
        if (!abortAllRef.current && enabledRef.current && !muted) {
          startSpeechRecognition(); // resume listening
        }
        stopWaveCanvas();
        window.__GLOBAL_TTS_CTRL!.isPlaying = false;
      };
      audio.onerror = () => {
        isTtsPlayingRef.current = false;
        onSpeakingChange?.(false);
        log("TTS error");
        playNext();
        if (!abortAllRef.current && enabledRef.current && !muted)
          startSpeechRecognition();
        stopWaveCanvas();
        window.__GLOBAL_TTS_CTRL!.isPlaying = false;
      };
      await audio.play();
    } catch (err) {
      console.error(err);
      isTtsPlayingRef.current = false;
      onSpeakingChange?.(false);
      window.__GLOBAL_TTS_CTRL!.isPlaying = false;
      playNext();
    }
  };

  const playNext = () => {
    const ctrl = window.__GLOBAL_TTS_CTRL!;
    if (ctrl.isPlaying) return; // already in progress
    const next = ctrl.queue.shift();
    if (!next) return; // nothing to play

    // Mark as playing *before* starting the async fetch to avoid races
    ctrl.isPlaying = true;

    playText(next.text, next.agentId).catch(() => {
      // If playback fails, clear playing flag so queue can continue
      ctrl.isPlaying = false;
      playNext();
    });
  };

  // returns a function to speak text via ElevenLabs
  const speak = async (text: string) => {
    if (!text) return;
    if (!elevenLabsApiKey) {
      alert("ElevenLabs API key missing");
      return;
    }
    const ctrl = window.__GLOBAL_TTS_CTRL!;
    ctrl.queue.push({ text, agentId: agentIdRef.current });
    log("Queued speech", ctrl.queue.length);
    playNext();
  };

  const stop = () => {
    log("STOP_INIT");
    console.trace("STOP_CALL_STACK");
    enabledRef.current = false; // disable
    abortAllRef.current = true;
    stopAnalyserLoop();
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // prevent any restart
      recognitionRef.current.onerror = null;
      recognitionRef.current.onresult = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    window.__GLOBAL_TTS_CTRL!.queue = [];
    stopWaveCanvas();
    if (restAnimIdRef.current) {
      cancelAnimationFrame(restAnimIdRef.current);
      restAnimIdRef.current = null;
    }
    isTtsPlayingRef.current = false;
    onSpeakingChange?.(false);
    // hard stop microphone stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      micActiveRef.current = false;
    }
    window.__VOICE_ENABLED = false as any;
    log("STOP_DONE");
  };

  const manualEnd = () => {
    recognitionRef.current?.stop?.();
  };

  const interruptSpeak = () => {
    if (isTtsPlayingRef.current && currentAudioRef.current) {
      log("INTERRUPT_REQUEST");
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      isTtsPlayingRef.current = false;
      onSpeakingChange?.(false);
      window.__GLOBAL_TTS_CTRL!.isPlaying = false;
      window.__GLOBAL_TTS_CTRL!.queue = [];
      playNext(); // will resume if queue not empty
      if (!abortAllRef.current && enabledRef.current && !muted)
        startSpeechRecognition();
      stopWaveCanvas();
    }
  };

  const resumeListening = () => {
    if (
      !abortAllRef.current &&
      enabledRef.current &&
      !muted &&
      !isTtsPlayingRef.current
    ) {
      // -----------------------------------------------------------
      //  MIC ↔️ ORB SCALE VISUALISATION (DO NOT REMOVE OR MODIFY)
      // -----------------------------------------------------------
      // When the orb is in listening mode we visualise RMS mic level by
      // scaling the circle via the CSS variable --orb-scale.  This is
      // driven by the analyser loop started in `startAnalyserLoop`.
      // Some browsers (esp. Safari) may automatically stop a MediaStream
      // track after the page has been backgrounded for a while; in that
      // case `
    }
  };

  // --------------------------------------------------------------------------------
  //  🔈 STATUS HELPERS
  // --------------------------------------------------------------------------------
  const [isSpeakingState] = useState<boolean>(() => false);
  // Expose speaking state via stable function
  const isSpeaking = () => isTtsPlayingRef.current;

  // Keep refs synced with latest props
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (enabled) abortAllRef.current = false;
  }, [enabled]);

  // ---------------------------------------------------------------------------
  //  ✅  GLOBAL SINGLETON GUARD (re-added)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const globalKey = "__VOICE_ASSISTANT_INSTANCE__" as const;
    const existing = (window as any)[globalKey] as
      | { agentId: string; stop: () => void }
      | undefined;

    if (existing && existing.agentId !== agentIdRef.current) {
      try {
        existing.stop();
      } catch (err) {
        console.warn(
          "[VoiceAssistant] Failed to stop existing instance while mounting a new one",
          err
        );
      }
    }

    (window as any)[globalKey] = {
      agentId: agentIdRef.current,
      stop,
    };

    return () => {
      const current = (window as any)[globalKey];
      if (current && current.agentId === agentIdRef.current) {
        delete (window as any)[globalKey];
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------------------------------
  //  📤 PUBLIC API
  // --------------------------------------------------------------------------------
  return {
    speak,
    stop,
    manualEnd,
    interruptSpeak,
    resumeListening,
    voiceError,
    isSpeaking, // expose for consumers that might need sync query
  };
}