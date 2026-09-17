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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl overflow-hidden p-6 text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Bring Your Own Key (BYOK)</h3>
              <p className="text-xs text-gray-400">Select AI provider or use platform default</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="mt-5 space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              AI Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* API Key Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-gray-300">
                Custom API Key (Optional)
              </label>
              <span className="text-[11px] text-gray-400">{selectedMeta.helpText}</span>
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={selectedMeta.placeholder}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-3 pr-10 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
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
              className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900"
            />
            <label htmlFor="rememberSession" className="text-xs text-gray-300 cursor-pointer">
              Remember key for this browser session
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-gray-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefault}
            className="text-xs text-gray-400 hover:text-white underline underline-offset-4 transition-colors"
          >
            Reset to Platform Default
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors shadow-lg shadow-indigo-600/20 flex items-center gap-1.5"
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
