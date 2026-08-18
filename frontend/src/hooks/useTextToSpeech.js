import { useState, useEffect, useRef, useCallback } from "react";
import { getVoiceProfile, selectOptimalVoice } from "../config/voiceProfiles";

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [activeVoice, setActiveVoice] = useState(null);
  const [activeProfile, setActiveProfile] = useState(null);

  const utteranceRef = useRef(null);

  // Load browser speech synthesis voices
  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setIsSupported(false);
      setError("Text-to-Speech is not supported in this browser environment.");
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      const chosen = selectOptimalVoice(voices);
      setActiveVoice(chosen);
    };

    loadVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Stop speech synthesis
  const stop = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      console.warn("TTS cancel error:", e);
    }
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  // Pause speech synthesis
  const pause = useCallback(() => {
    if (!("speechSynthesis" in window) || !isSpeaking) return;
    try {
      window.speechSynthesis.pause();
      setIsPaused(true);
    } catch (e) {
      console.warn("TTS pause error:", e);
    }
  }, [isSpeaking]);

  // Resume speech synthesis
  const resume = useCallback(() => {
    if (!("speechSynthesis" in window) || !isPaused) return;
    try {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } catch (e) {
      console.warn("TTS resume error:", e);
    }
  }, [isPaused]);

  // Main speak function
  const speak = useCallback((text, sectionOrTopic = "technical", callbacks = {}) => {
    if (!("speechSynthesis" in window) || !text) {
      if (callbacks.onEnd) callbacks.onEnd();
      return;
    }

    // Prevent overlapping utterances
    window.speechSynthesis.cancel();
    setError(null);
    setIsPaused(false);

    const profile = getVoiceProfile(sectionOrTopic, sectionOrTopic);
    setActiveProfile(profile);

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Apply voice profile settings
    utterance.rate = profile.rate;
    utterance.pitch = profile.pitch;
    utterance.volume = profile.volume;

    const chosenVoice = activeVoice || selectOptimalVoice(availableVoices);
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      if (callbacks.onStart) callbacks.onStart();
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      if (callbacks.onEnd) callbacks.onEnd();
    };

    utterance.onerror = (e) => {
      console.warn("TTS SpeechSynthesis Error:", e);
      setIsSpeaking(false);
      setIsPaused(false);
      setError(`Audio playback error: ${e.error || "speech canceled"}`);
      if (callbacks.onError) callbacks.onError(e);
      if (callbacks.onEnd) callbacks.onEnd();
    };

    utterance.onpause = () => {
      setIsPaused(true);
      if (callbacks.onPause) callbacks.onPause();
    };

    utterance.onresume = () => {
      setIsPaused(false);
      if (callbacks.onResume) callbacks.onResume();
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Failed to trigger speech synthesis:", e);
      setIsSpeaking(false);
      setError("Failed to trigger speech synthesis.");
      if (callbacks.onEnd) callbacks.onEnd();
    }
  }, [activeVoice, availableVoices]);

  // Replay helper
  const replay = useCallback((text, sectionOrTopic = "technical", callbacks = {}) => {
    stop();
    setTimeout(() => {
      speak(text, sectionOrTopic, callbacks);
    }, 100);
  }, [stop, speak]);

  return {
    isSpeaking,
    isPaused,
    isSupported,
    error,
    activeProfile,
    activeVoice,
    availableVoices,
    speak,
    pause,
    resume,
    stop,
    replay
  };
}
