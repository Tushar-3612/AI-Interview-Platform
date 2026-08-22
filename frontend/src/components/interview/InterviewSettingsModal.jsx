import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Volume2, Mic, Play, Square, Sparkles, Check, X, User, Sliders } from "lucide-react";
import { selectOptimalVoice } from "../../config/voiceProfiles";
import toast from "react-hot-toast";

const PRESET_PERSONAS = [
  {
    id: "auto",
    name: "Adaptive Persona",
    desc: "Auto-detects based on Round (Alex for Tech, Sarah for HR)",
    icon: Sparkles,
    color: "#3b82f6"
  },
  {
    id: "alex",
    name: "Alex (Technical)",
    desc: "Senior Technical Evaluator • Deep & Analytical Male Voice",
    icon: User,
    color: "#10b981"
  },
  {
    id: "sarah",
    name: "Sarah (HR & Culture)",
    desc: "Senior HR & Behavioral Lead • Warm & Professional Female Voice",
    icon: User,
    color: "#a855f7"
  },
  {
    id: "custom",
    name: "Custom Browser Voice",
    desc: "Select specifically from your device's installed TTS voices",
    icon: Sliders,
    color: "#f59e0b"
  }
];

function InterviewSettingsModal({
  isOpen,
  onClose,
  voiceSettings,
  onSaveVoiceSettings,
  currentSection = "TECHNICAL"
}) {
  const [selectedPersona, setSelectedPersona] = useState(voiceSettings?.persona || "auto");
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(voiceSettings?.voiceURI || "");
  const [rate, setRate] = useState(voiceSettings?.rate || 0.92);
  const [pitch, setPitch] = useState(voiceSettings?.pitch || 0.90);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  // Load browser voices
  useEffect(() => {
    const updateVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      // Prioritize English voices or all installed voices
      const filtered = voices.filter(v => v.lang.startsWith("en") || !v.lang);
      setAvailableVoices(filtered.length > 0 ? filtered : voices);
    };

    updateVoices();
    if (window.speechSynthesis?.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Sync with prop changes
  useEffect(() => {
    if (isOpen) {
      setSelectedPersona(voiceSettings?.persona || "auto");
      setSelectedVoiceURI(voiceSettings?.voiceURI || "");
      setRate(voiceSettings?.rate || 0.92);
      setPitch(voiceSettings?.pitch || 0.90);
    }
  }, [isOpen, voiceSettings]);

  if (!isOpen) return null;

  // Test voice output
  const handleTestVoice = () => {
    if (isPlayingTest) {
      window.speechSynthesis?.cancel();
      setIsPlayingTest(false);
      return;
    }

    window.speechSynthesis?.cancel();

    const textSample =
      selectedPersona === "sarah"
        ? "Hello! I am Sarah, your AI HR interviewer. I look forward to hearing about your experiences and achievements."
        : selectedPersona === "alex"
        ? "Hello, I am Alex, your senior AI technical interviewer. We will evaluate your technical architecture and problem-solving skills."
        : "Hello! This is a preview of your AI interviewer voice. How does this sound?";

    const utterance = new SpeechSynthesisUtterance(textSample);
    utterance.rate = rate;
    utterance.pitch = pitch;

    const voices = window.speechSynthesis?.getVoices() || [];

    if (selectedPersona === "custom" && selectedVoiceURI) {
      const chosen = voices.find(v => v.voiceURI === selectedVoiceURI || v.name === selectedVoiceURI);
      if (chosen) utterance.voice = chosen;
    } else if (selectedPersona === "sarah") {
      const optimal = selectOptimalVoice(voices, "HR");
      if (optimal) utterance.voice = optimal;
    } else if (selectedPersona === "alex") {
      const optimal = selectOptimalVoice(voices, "TECHNICAL");
      if (optimal) utterance.voice = optimal;
    } else {
      const optimal = selectOptimalVoice(voices, currentSection);
      if (optimal) utterance.voice = optimal;
    }

    utterance.onstart = () => setIsPlayingTest(true);
    utterance.onend = () => setIsPlayingTest(false);
    utterance.onerror = () => setIsPlayingTest(false);

    window.speechSynthesis?.speak(utterance);
  };

  const handleSave = () => {
    window.speechSynthesis?.cancel();
    setIsPlayingTest(false);

    const newSettings = {
      persona: selectedPersona,
      voiceURI: selectedVoiceURI,
      rate,
      pitch
    };

    onSaveVoiceSettings(newSettings);
    toast.success("Voice preferences saved!", { id: "voice-settings-saved" });
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            window.speechSynthesis?.cancel();
            setIsPlayingTest(false);
            onClose();
          }}
          className="absolute inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Interview Room Settings</h2>
                <p className="text-xs text-white/50">Configure AI interviewer voice & speech audio</p>
              </div>
            </div>
            <button
              onClick={() => {
                window.speechSynthesis?.cancel();
                setIsPlayingTest(false);
                onClose();
              }}
              className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1" style={{ scrollbarWidth: "thin" }}>
            
            {/* Section 1: Voice Persona Selection */}
            <div className="space-y-2.5">
              <label className="text-xs font-black uppercase tracking-wider text-white/60">
                Interviewer Voice Persona
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PRESET_PERSONAS.map((p) => {
                  const Icon = p.icon;
                  const isSelected = selectedPersona === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPersona(p.id)}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                        isSelected
                          ? "bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-600/10"
                          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-white/10" style={{ color: p.color }}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold">{p.name}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed">{p.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Specific Voice Dropdown if Custom is Selected */}
            {selectedPersona === "custom" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5 p-3 rounded-2xl bg-white/5 border border-white/10"
              >
                <label className="text-[11px] font-bold text-white/70">
                  Select Installed System Voice ({availableVoices.length} available)
                </label>
                <select
                  value={selectedVoiceURI}
                  onChange={(e) => setSelectedVoiceURI(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 p-2.5 text-xs text-white outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Default System Voice</option>
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>
                      {v.name} ({v.lang}) {v.default ? "• Default" : ""}
                    </option>
                  ))}
                </select>
              </motion.div>
            )}

            {/* Section 3: Speech Pace (Rate) & Pitch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span>Speaking Speed</span>
                  <span className="font-mono text-blue-400">{rate.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.25"
                  step="0.02"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-white/35">
                  <span>Slow</span>
                  <span>Normal</span>
                  <span>Fast</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span>Voice Tone / Pitch</span>
                  <span className="font-mono text-blue-400">{pitch.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.25"
                  step="0.02"
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-white/35">
                  <span>Deep</span>
                  <span>Standard</span>
                  <span>High</span>
                </div>
              </div>
            </div>

            {/* Section 4: Live Audio Preview */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Test Voice Playback</p>
                  <p className="text-[10px] text-white/50">Listen to a sample phrase with your current configuration</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestVoice}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  isPlayingTest
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20"
                }`}
              >
                {isPlayingTest ? (
                  <>
                    <Square className="w-3 h-3 fill-current" /> Stop
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" /> Test Voice
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-slate-950/60">
            <button
              type="button"
              onClick={() => {
                window.speechSynthesis?.cancel();
                setIsPlayingTest(false);
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition shadow-lg shadow-blue-600/30"
            >
              Save Voice Settings
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default InterviewSettingsModal;
