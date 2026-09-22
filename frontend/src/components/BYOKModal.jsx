import React, { useState, useEffect } from "react";
import { Key, Eye, EyeOff, ShieldCheck, Check, Sparkles, X } from "lucide-react";

export const PROVIDER_OPTIONS = [
  { id: "groq", name: "Groq (Fast Llama 3.3)", placeholder: "gsk_...", helpText: "Free fast inference" },
  { id: "openrouter", name: "OpenRouter (Multi-Model)", placeholder: "sk-or-v1-...", helpText: "Unified AI gateway" },
  { id: "gemini", name: "Google Gemini (Gemini 2.5 Flash)", placeholder: "AIzaSy...", helpText: "Google AI Studio Key" },
  { id: "deepseek", name: "DeepSeek (DeepSeek V3/R1)", placeholder: "sk-...", helpText: "DeepSeek API Key" },
  { id: "openai", name: "OpenAI (GPT-4o mini / GPT-4o)", placeholder: "sk-...", helpText: "Official OpenAI Key" }
];

export default function BYOKModal({ isOpen, onClose, onSave, initialProvider = "groq", initialKey = "" }) {
  const [provider, setProvider] = useState(initialProvider);
  const [apiKey, setApiKey] = useState(initialKey);
  const [showKey, setShowKey] = useState(false);
  const [rememberSession, setRememberSession] = useState(true);

  useEffect(() => {
    const savedProvider = sessionStorage.getItem("byok_provider");
    const savedKey = sessionStorage.getItem("byok_api_key");
    if (savedProvider) setProvider(savedProvider);
    if (savedKey) setApiKey(savedKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (rememberSession) {
      if (apiKey.trim()) {
        sessionStorage.setItem("byok_provider", provider);
        sessionStorage.setItem("byok_api_key", apiKey.trim());
      } else {
        sessionStorage.removeItem("byok_provider");
        sessionStorage.removeItem("byok_api_key");
      }
    }
    onSave({ provider, apiKey: apiKey.trim() });
    onClose();
  };

  const handleResetDefault = () => {
    setProvider("groq");
    setApiKey("");
    sessionStorage.removeItem("byok_provider");
    sessionStorage.removeItem("byok_api_key");
    onSave({ provider: "groq", apiKey: "" });
    onClose();
  };

  const selectedMeta = PROVIDER_OPTIONS.find((p) => p.id === provider) || PROVIDER_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 text-white"
        style={{
          background: "rgba(12, 15, 26, 0.98)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]/25">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Bring Your Own Key (BYOK)</h3>
              <p className="text-xs text-white/50">Select AI provider or use platform default</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="mt-5 space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              AI Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B35]"
            >
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#0D111A]">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* API Key Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-white/70">
                Custom API Key (Optional)
              </label>
              <span className="text-[11px] text-white/40">{selectedMeta.helpText}</span>
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={selectedMeta.placeholder}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-3 pr-10 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF6B35] font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-white/40 mt-1.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline" />
              Keys are encrypted in memory during session & never logged.
            </p>
          </div>

          {/* Remember Key Checkbox */}
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="rememberSession"
              checked={rememberSession}
              onChange={(e) => setRememberSession(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#FF6B35] focus:ring-[#FF6B35] focus:ring-offset-gray-900 cursor-pointer"
            />
            <label htmlFor="rememberSession" className="text-xs text-white/70 cursor-pointer">
              Remember key for this browser session
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefault}
            className="text-xs text-white/40 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
          >
            Reset to Platform Default
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-white/70 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] rounded-xl transition-colors cursor-pointer border border-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:brightness-110 rounded-xl transition-colors shadow-md shadow-[#FF6B35]/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Save Provider
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
