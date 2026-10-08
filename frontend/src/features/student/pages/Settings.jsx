import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
  Zap,
  Sparkles,
  RefreshCw,
  Cpu,
  Layers,
  HelpCircle,
  Sliders,
  Check,
  Lock,
  AlertTriangle,
  ArrowRight,
  ClipboardPaste,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTheme } from "../../../core/hooks/useTheme.jsx";
import {
  fetchStudentApiKeys,
  saveStudentApiKey,
  deleteStudentApiKey,
  updateStudentApiKeyPreference,
  testStudentApiKeyConnection,
} from "../services/apiKeysService.js";

const PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini",
    defaultModel: "gemini-3.8-flash",
    description: "High-speed reasoning with large context window. Recommended for college students.",
    docsUrl: "https://aistudio.google.com/app/apikey",
    badge: "Free & Recommended",
    badgeColor: "emerald",
    accentColor: "#10B981",
  },
  {
    id: "groq",
    name: "Groq LPU",
    defaultModel: "openai/gpt-oss-120b",
    description: "Ultra-low latency inference for Llama 3.3 and DeepSeek R1 distill models.",
    docsUrl: "https://console.groq.com/keys",
    keyPrefixHint: "gsk_...",
    badge: "Ultra Fast",
    badgeColor: "amber",
    accentColor: "#F59E0B",
  },
  {
    id: "openai",
    name: "OpenAI",
    defaultModel: "gpt-6",
    description: "Industry gold standard for structured interviews, code evaluation, and technical depth.",
    docsUrl: "https://platform.openai.com/api-keys",
    keyPrefixHint: "sk-...",
    badge: "Industry Standard",
    badgeColor: "blue",
    accentColor: "#3B82F6",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    defaultModel: "deepseek-v4.1-flash",
    description: "Deep reasoning with DeepSeek V3/R1 architecture at high cost efficiency.",
    docsUrl: "https://platform.deepseek.com",
    keyPrefixHint: "sk-...",
    badge: "Deep Reasoning",
    badgeColor: "purple",
    accentColor: "#8B5CF6",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    defaultModel: "openai/gpt-oss-120b",
    description: "Unified AI gateway offering unified routing across hundreds of open models.",
    docsUrl: "https://openrouter.ai/keys",
    keyPrefixHint: "sk-or-v1-...",
    badge: "Multi-Model Router",
    badgeColor: "rose",
    accentColor: "#F43F5E",
  },
];

export default function Settings() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState("api-keys"); // 'api-keys' | 'preferences' | 'guide'

  // API Keys state
  const [loading, setLoading] = useState(true);
  const [keysData, setKeysData] = useState({
    preferredProvider: "platform",
    useCustomKey: false,
    providers: {},
  });

  // Selected provider card for inspection/editing
  const [selectedProviderId, setSelectedProviderId] = useState("gemini");
  const [inputKey, setInputKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  // Testing & Saving states
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string, latencyMs?: number }

  const isDark = theme === "dark";

  // Load API keys on mount
  const loadApiKeys = async () => {
    try {
      setLoading(true);
      const data = await fetchStudentApiKeys();
      if (data) {
        setKeysData(data);
        if (data.preferredProvider && data.preferredProvider !== "platform") {
          setSelectedProviderId(data.preferredProvider);
        }
      }
    } catch (err) {
      console.error("Failed to load API keys:", err);
      toast.error("Could not fetch API key configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApiKeys();
  }, []);

  const selectedMeta = useMemo(() => {
    return PROVIDERS.find((p) => p.id === selectedProviderId) || PROVIDERS[0];
  }, [selectedProviderId]);

  const currentConfig = keysData.providers?.[selectedProviderId] || {};
  const isConfigured = Boolean(currentConfig.isConfigured);
  const isPreferred = keysData.preferredProvider === selectedProviderId;

  // Handle switching selected provider card
  const handleSelectProvider = (provId) => {
    setSelectedProviderId(provId);
    setInputKey("");
    setShowKey(false);
    setTestResult(null);
  };

  // Toggle Custom Key mode
  const handleToggleCustomMode = async () => {
    const nextVal = !keysData.useCustomKey;
    try {
      await updateStudentApiKeyPreference({
        useCustomKey: nextVal,
        preferredProvider:
          nextVal && keysData.preferredProvider === "platform"
            ? selectedProviderId
            : keysData.preferredProvider,
      });

      setKeysData((prev) => ({
        ...prev,
        useCustomKey: nextVal,
        preferredProvider:
          nextVal && prev.preferredProvider === "platform"
            ? selectedProviderId
            : prev.preferredProvider,
      }));

      toast.success(
        nextVal
          ? "Custom AI Key (BYOK) mode activated!"
          : "Switched to platform default shared model."
      );
    } catch (err) {
      toast.error("Failed to update preference: " + err.message);
    }
  };

  // Set as preferred provider
  const handleSetAsPreferred = async (provId) => {
    try {
      await updateStudentApiKeyPreference({
        preferredProvider: provId,
        useCustomKey: true,
      });
      setKeysData((prev) => ({
        ...prev,
        preferredProvider: provId,
        useCustomKey: true,
      }));
      toast.success(`${PROVIDERS.find((p) => p.id === provId)?.name} set as primary AI provider!`);
    } catch (err) {
      toast.error("Failed to set preferred provider: " + err.message);
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    const keyToTest = inputKey.trim() || undefined;
    if (!keyToTest && !isConfigured) {
      toast.error("Please enter an API key to test");
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testStudentApiKeyConnection({
        provider: selectedProviderId,
        apiKey: keyToTest,
      });

      if (res.success) {
        setTestResult({
          success: true,
          message: res.message || "Connection validated successfully!",
          latencyMs: res.data?.latencyMs,
          model: res.data?.model,
        });
        toast.success(`Success! Connected in ${res.data?.latencyMs || "N/A"}ms`);

        // Refresh keys to reflect "verified" status
        const refreshed = await fetchStudentApiKeys();
        if (refreshed) setKeysData(refreshed);
      } else {
        setTestResult({
          success: false,
          message: res.message || "Connection test failed",
        });
        toast.error("Test failed: " + (res.message || "Invalid response"));
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Verification failed";
      setTestResult({
        success: false,
        message: msg,
      });
      toast.error("Test error: " + msg);
    } finally {
      setIsTesting(false);
    }
  };

  // Save / Update key
  const handleSaveKey = async () => {
    const key = inputKey.trim();
    if (!key) {
      toast.error("Please paste or type an API key");
      return;
    }

    if (key.length < 8) {
      toast.error("API key is too short. Please verify your key.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveStudentApiKey({
        provider: selectedProviderId,
        apiKey: key,
        setAsPreferred: true,
      });

      if (res.success) {
        toast.success(`${selectedMeta.name} API key encrypted and saved!`);
        setInputKey("");
        setShowKey(false);
        setTestResult(null);

        // Reload data
        const refreshed = await fetchStudentApiKeys();
        if (refreshed) setKeysData(refreshed);
      } else {
        toast.error(res.message || "Failed to save API key");
      }
    } catch (err) {
      toast.error("Error saving key: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  // Delete key
  const handleDeleteKey = async () => {
    if (!window.confirm(`Are you sure you want to remove your ${selectedMeta.name} API key?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteStudentApiKey(selectedProviderId);
      if (res.success) {
        toast.success(`${selectedMeta.name} key removed.`);
        setInputKey("");
        setTestResult(null);

        // Reload data
        const refreshed = await fetchStudentApiKeys();
        if (refreshed) setKeysData(refreshed);
      } else {
        toast.error(res.message || "Failed to remove key");
      }
    } catch (err) {
      toast.error("Error deleting key: " + (err.response?.data?.message || err.message));
    } finally {
      setIsDeleting(false);
    }
  };

  // Paste from clipboard helper
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputKey(text.trim());
        toast.success("Pasted from clipboard!");
      }
    } catch (err) {
      toast.error("Could not read clipboard. Please paste manually.");
    }
  };

  return (
    <div
      className="min-h-screen pb-20 transition-colors duration-200"
      style={{
        background: isDark ? "#0A0D14" : "#F8FAFC",
        color: isDark ? "#FFFFFF" : "#0F172A",
      }}
    >
      {/* ── Page Header ── */}
      <div
        className="border-b"
        style={{
          borderColor: isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.08)",
          background: isDark ? "rgba(12, 15, 23, 0.85)" : "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]/25">
                  <Key className="w-5 h-5" />
                </span>
                <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
              </div>
              <p
                className="text-xs sm:text-sm mt-1.5"
                style={{ color: isDark ? "#94A3B8" : "#64748B" }}
              >
                Manage Bring-Your-Own-Key (BYOK) AI providers, test credentials, and configure personal preferences.
              </p>
            </div>

            {/* Active Mode Status Badge */}
            <div
              className="flex items-center gap-3 px-4 py-2.5 rounded-2xl border"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.03)" : "#FFFFFF",
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{
                  background: keysData.useCustomKey ? "#10B981" : "#FF6B35",
                  boxShadow: keysData.useCustomKey
                    ? "0 0 10px #10B981"
                    : "0 0 10px #FF6B35",
                }}
              />
              <div className="text-xs">
                <p className="font-semibold">
                  {keysData.useCustomKey
                    ? `BYOK Mode: ${PROVIDERS.find((p) => p.id === keysData.preferredProvider)?.name ||
                    keysData.preferredProvider
                    }`
                    : "Platform Shared Model"}
                </p>
                <p style={{ color: isDark ? "#64748B" : "#94A3B8" }}>
                  {keysData.useCustomKey
                    ? "Using your personal API credentials"
                    : "Using default PrepHire server quota"}
                </p>
              </div>
            </div>
          </div>

          {/* ── Tabs Navigation ── */}
          <div className="flex gap-2 mt-6 pt-2 border-t" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)" }}>
            <button
              onClick={() => setActiveTab("api-keys")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === "api-keys"
                ? "bg-[#FF6B35] text-white shadow-md shadow-[#FF6B35]/25"
                : isDark
                  ? "text-slate-400 hover:text-white hover:bg-white/5"
                  : "text-slate-600 hover:text-black hover:bg-black/5"
                }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Manage API Keys (BYOK)</span>
            </button>

            <button
              onClick={() => setActiveTab("guide")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === "guide"
                ? "bg-[#FF6B35] text-white shadow-md shadow-[#FF6B35]/25"
                : isDark
                  ? "text-slate-400 hover:text-white hover:bg-white/5"
                  : "text-slate-600 hover:text-black hover:bg-black/5"
                }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Free API Key Setup Guide</span>
            </button>

            <button
              onClick={() => setActiveTab("preferences")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === "preferences"
                ? "bg-[#FF6B35] text-white shadow-md shadow-[#FF6B35]/25"
                : isDark
                  ? "text-slate-400 hover:text-white hover:bg-white/5"
                  : "text-slate-600 hover:text-black hover:bg-black/5"
                }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Interview Preferences</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Container ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ══════════════════════════════════════════════════════
            TAB 1: MANAGE API KEYS (BYOK)
        ══════════════════════════════════════════════════════ */}
        {activeTab === "api-keys" && (
          <div className="space-y-7">
            {/* ── Mode Switcher Card ── */}
            <div
              className="p-5 sm:p-6 rounded-2xl border transition-all"
              style={{
                background: isDark ? "rgba(18, 22, 34, 0.7)" : "#FFFFFF",
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
                boxShadow: isDark
                  ? "0 4px 20px rgba(0, 0, 0, 0.2)"
                  : "0 2px 12px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#FF6B35]" />
                    <h2 className="text-sm font-bold tracking-wide uppercase text-[#FF6B35]">
                      Bring Your Own Key (BYOK) Mode
                    </h2>
                  </div>
                  <p className="text-base font-semibold">
                    Use your personal API keys for real interviews, coding assessments & practice
                  </p>
                  <p
                    className="text-xs sm:text-sm leading-relaxed max-w-2xl"
                    style={{ color: isDark ? "#94A3B8" : "#64748B" }}
                  >
                    Providing your own API key removes queue rate limits, unlocks faster response generation, and ensures 100% independent quota for all interview stages.
                  </p>
                </div>

                {/* Toggle Button */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold" style={{ color: isDark ? "#94A3B8" : "#64748B" }}>
                    {keysData.useCustomKey ? "Enabled" : "Disabled"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={keysData.useCustomKey}
                    onClick={handleToggleCustomMode}
                    className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${keysData.useCustomKey ? "bg-[#10B981]" : isDark ? "bg-slate-700" : "bg-slate-300"
                      }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${keysData.useCustomKey ? "translate-x-6" : "translate-x-0"
                        }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Provider Cards Grid ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Select AI Provider to Configure
                </h3>
                <span className="text-xs" style={{ color: isDark ? "#64748B" : "#94A3B8" }}>
                  5 Providers Supported
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {PROVIDERS.map((prov) => {
                  const conf = keysData.providers?.[prov.id];
                  const configured = Boolean(conf?.isConfigured);
                  const isSelected = selectedProviderId === prov.id;
                  const isActiveDefault = keysData.preferredProvider === prov.id;

                  return (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => handleSelectProvider(prov.id)}
                      className={`relative p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between group ${isSelected
                        ? "border-[#FF6B35] ring-2 ring-[#FF6B35]/25 shadow-lg"
                        : isDark
                          ? "border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04]"
                          : "border-black/10 hover:border-black/20 bg-white hover:bg-slate-50"
                        }`}
                      style={{
                        background: isSelected
                          ? isDark
                            ? "rgba(255, 107, 53, 0.08)"
                            : "rgba(255, 107, 53, 0.04)"
                          : undefined,
                      }}
                    >
                      <div>
                        {/* Top Badges */}
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: isDark ? "rgba(255, 255, 255, 0.06)" : "#F1F5F9",
                              color: prov.accentColor,
                            }}
                          >
                            {prov.badge}
                          </span>

                          {configured && (
                            <span className="flex items-center text-[10px] text-emerald-500 font-semibold gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                            </span>
                          )}
                        </div>

                        {/* Provider Name */}
                        <h4 className="text-sm font-bold leading-tight">{prov.name}</h4>
                        <p
                          className="text-[11px] font-mono mt-1 truncate"
                          style={{ color: isDark ? "#64748B" : "#94A3B8" }}
                        >
                          {prov.defaultModel}
                        </p>
                      </div>

                      {/* Bottom Status Indicator */}
                      <div className="mt-4 pt-2.5 border-t border-inherit flex items-center justify-between text-[11px]">
                        <span
                          className={`font-medium ${configured ? "text-emerald-500" : isDark ? "text-slate-500" : "text-slate-400"
                            }`}
                        >
                          {configured ? "Configured" : "Not Set"}
                        </span>

                        {isActiveDefault && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FF6B35]/15 text-[#FF6B35]">
                            ACTIVE
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Detailed Key Configuration Box for Selected Provider ── */}
            <div
              className="p-6 rounded-2xl border transition-all"
              style={{
                background: isDark ? "rgba(16, 20, 31, 0.9)" : "#FFFFFF",
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                boxShadow: isDark
                  ? "0 10px 30px rgba(0, 0, 0, 0.3)"
                  : "0 4px 20px rgba(0, 0, 0, 0.05)",
              }}
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-inherit">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md"
                    style={{ background: selectedMeta.accentColor }}
                  >
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold">{selectedMeta.name} API Key Configuration</h3>
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
                          color: selectedMeta.accentColor,
                        }}
                      >
                        Model: {selectedMeta.defaultModel}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: isDark ? "#94A3B8" : "#64748B" }}>
                      {selectedMeta.description}
                    </p>
                  </div>
                </div>

                {/* Direct Console Link */}
                <a
                  href={selectedMeta.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 hover:scale-102"
                  style={{
                    borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)",
                    color: "#FF6B35",
                    background: isDark ? "rgba(255, 107, 53, 0.08)" : "rgba(255, 107, 53, 0.04)",
                  }}
                >
                  <span>Get Free Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Status & Masked Display if Configured */}
              {isConfigured && (
                <div
                  className="mt-5 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  style={{
                    background: isDark ? "rgba(16, 185, 129, 0.06)" : "rgba(16, 185, 129, 0.04)",
                    borderColor: "rgba(16, 185, 129, 0.25)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                          Key Saved in Secure Vault
                        </span>
                        {isPreferred && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF6B35] text-white">
                            Active Preferred
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs font-bold mt-0.5 text-emerald-400">
                        {currentConfig.maskedKey || "••••••••••••••••"}
                      </p>
                      {currentConfig.lastTestedAt && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Last verified: {new Date(currentConfig.lastTestedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isPreferred && (
                      <button
                        type="button"
                        onClick={() => handleSetAsPreferred(selectedProviderId)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all cursor-pointer"
                      >
                        Set as Active
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleDeleteKey}
                      className="p-2 rounded-xl text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
                      title="Remove saved key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Key Input Form */}
              <div className="mt-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {isConfigured ? "Update API Key (Replace Current)" : "Enter API Key"}
                    </label>
                    <span className="text-[11px]" style={{ color: isDark ? "#64748B" : "#94A3B8" }}>
                      Expected format: <code className="font-mono">{selectedMeta.keyPrefixHint}</code>
                    </span>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      type={showKey ? "text" : "password"}
                      value={inputKey}
                      onChange={(e) => {
                        setInputKey(e.target.value);
                        setTestResult(null);
                      }}
                      placeholder={isConfigured ? "Paste new key here to replace..." : `Paste your ${selectedMeta.name} key...`}
                      className="w-full px-4 py-3 rounded-xl border text-sm font-mono focus:outline-none transition-all pr-24"
                      style={{
                        background: isDark ? "rgba(255, 255, 255, 0.04)" : "#F8FAFC",
                        borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.15)",
                        color: isDark ? "#FFFFFF" : "#0F172A",
                      }}
                    />

                    <div className="absolute right-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handlePasteClipboard}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Paste from clipboard"
                      >
                        <ClipboardPaste className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title={showKey ? "Hide key" : "Show key"}
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Test Result Message Banner */}
                {testResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium ${testResult.success
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                    {testResult.latencyMs && (
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20">
                        {testResult.latencyMs}ms
                      </span>
                    )}
                  </motion.div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Lock className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Encrypted with AES-256-GCM</span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Test Connection Button */}
                    <button
                      type="button"
                      disabled={isTesting || (!inputKey.trim() && !isConfigured)}
                      onClick={handleTestConnection}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5"
                      style={{
                        borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)",
                        color: isDark ? "#FFFFFF" : "#0F172A",
                      }}
                    >
                      {isTesting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>Test Connection</span>
                        </>
                      )}
                    </button>

                    {/* Save Key Button */}
                    <button
                      type="button"
                      disabled={isSaving || !inputKey.trim()}
                      onClick={handleSaveKey}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 shadow-md shadow-[#FF6B35]/25"
                      style={{ background: "#FF6B35" }}
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Save & Activate</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Security & Privacy Assurance Notice ── */}
            <div
              className="p-5 rounded-2xl border"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.02)" : "#FFFFFF",
                borderColor: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)",
              }}
            >
              <div className="flex items-start gap-3.5">
                <ShieldCheck className="w-5 h-5 text-[#FF6B35] shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <h4 className="font-bold text-sm">Security & Privacy Architecture</h4>
                  <p className="leading-relaxed" style={{ color: isDark ? "#94A3B8" : "#64748B" }}>
                    Your API keys are stored in a dedicated encrypted format using symmetric AES-256-GCM. Plaintext keys are never returned across frontend network requests. When you enter an AI interview, your key is safely passed into an ephemeral sandbox in memory and never logged or exposed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 2: FREE API KEY SETUP GUIDE
        ══════════════════════════════════════════════════════ */}
        {activeTab === "guide" && (
          <div className="space-y-6">
            <div
              className="p-6 rounded-2xl border"
              style={{
                background: isDark ? "rgba(18, 22, 34, 0.7)" : "#FFFFFF",
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
              }}
            >
              <h2 className="text-lg font-bold">How to Obtain Free API Keys for PrepHire</h2>
              <p className="text-xs sm:text-sm mt-1" style={{ color: isDark ? "#94A3B8" : "#64748B" }}>
                Follow these step-by-step guides to get free developer keys from top AI providers in under 2 minutes.
              </p>
            </div>

            {/* Step 1: Google Gemini */}
            <div
              className="p-6 rounded-2xl border space-y-4"
              style={{
                background: isDark ? "rgba(16, 20, 31, 0.9)" : "#FFFFFF",
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/30">
                    1
                  </span>
                  <div>
                    <h3 className="font-bold text-base">Google Gemini (Recommended — 100% Free)</h3>
                    <p className="text-xs text-slate-400">Model: Gemini 3.8 Flash • Generous free rate limits</p>
                  </div>
                </div>

                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FF6B35] text-white hover:brightness-110 flex items-center gap-1.5"
                >
                  <span>Google AI Studio</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <ol className="list-decimal list-inside text-xs sm:text-sm space-y-2 text-slate-300">
                <li>Sign in to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[#FF6B35] underline">Google AI Studio</a> with any regular Google account.</li>
                <li>Click the blue <strong>"Create API key"</strong> button in the top left.</li>
                <li>Select a project or create a default new project.</li>
                <li>Copy the generated key (starts with <code className="font-mono text-emerald-400">AIzaSy...</code> or <code className="font-mono text-emerald-400">AQ...</code>).</li>
                <li>Return here to the <strong>Manage API Keys</strong> tab, select Google Gemini, paste and click <strong>Save & Activate</strong>!</li>
              </ol>
            </div>

            {/* Step 2: Groq */}
            <div
              className="p-6 rounded-2xl border space-y-4"
              style={{
                background: isDark ? "rgba(16, 20, 31, 0.9)" : "#FFFFFF",
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 font-bold flex items-center justify-center text-sm border border-amber-500/30">
                    2
                  </span>
                  <div>
                    <h3 className="font-bold text-base">Groq Cloud (Fastest Inference Speed)</h3>
                    <p className="text-xs text-slate-400">Model: openai/gpt-oss-120b • Real-time voice response</p>
                  </div>
                </div>

                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FF6B35] text-white hover:brightness-110 flex items-center gap-1.5"
                >
                  <span>Groq Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <ol className="list-decimal list-inside text-xs sm:text-sm space-y-2 text-slate-300">
                <li>Sign up for a free account at <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-[#FF6B35] underline">Groq Cloud</a>.</li>
                <li>Navigate to the <strong>API Keys</strong> tab in the sidebar.</li>
                <li>Click <strong>"Create API Key"</strong>, give it a label like <em>PrepHire-Key</em>.</li>
                <li>Copy the key (starts with <code className="font-mono text-amber-400">gsk_...</code>).</li>
                <li>Paste in PrepHire under Groq and click <strong>Save & Activate</strong>!</li>
              </ol>
            </div>

            {/* Step 3: OpenRouter */}
            <div
              className="p-6 rounded-2xl border space-y-4"
              style={{
                background: isDark ? "rgba(16, 20, 31, 0.9)" : "#FFFFFF",
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-400 font-bold flex items-center justify-center text-sm border border-rose-500/30">
                    3
                  </span>
                  <div>
                    <h3 className="font-bold text-base">OpenRouter (Multi-Model Flexibility)</h3>
                    <p className="text-xs text-slate-400">One key for Claude, Llama, DeepSeek, and Mistral</p>
                  </div>
                </div>

                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FF6B35] text-white hover:brightness-110 flex items-center gap-1.5"
                >
                  <span>OpenRouter</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                OpenRouter provides a unified API interface with free and low-cost models. Get your key at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-[#FF6B35] underline">openrouter.ai/keys</a> (starts with <code className="font-mono text-rose-400">sk-or-v1-...</code>).
              </p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 3: INTERVIEW PREFERENCES
        ══════════════════════════════════════════════════════ */}
        {activeTab === "preferences" && (
          <div className="space-y-6">
            <div
              className="p-6 rounded-2xl border"
              style={{
                background: isDark ? "rgba(18, 22, 34, 0.7)" : "#FFFFFF",
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
              }}
            >
              <h2 className="text-lg font-bold">Interview Persona & Audio Preferences</h2>
              <p className="text-xs sm:text-sm mt-1" style={{ color: isDark ? "#94A3B8" : "#64748B" }}>
                Customize voice demeanor and interviewer behavior during real AI sessions.
              </p>
            </div>

            <div
              className="p-6 rounded-2xl border space-y-5"
              style={{
                background: isDark ? "rgba(16, 20, 31, 0.9)" : "#FFFFFF",
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
              }}
            >
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Interviewer Persona
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                  {[
                    { id: "auto", name: "Adaptive", desc: "Auto-adjusts based on round (Tech vs HR)" },
                    { id: "alex", name: "Alex (Technical)", desc: "Senior Architect • Deep & analytical" },
                    { id: "sarah", name: "Sarah (HR)", desc: "Lead Recruiter • Culture & behavior" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toast.success(`Persona set to ${p.name}`)}
                      className="p-3.5 rounded-xl border text-left cursor-pointer transition-all hover:border-[#FF6B35]"
                      style={{
                        background: isDark ? "rgba(255, 255, 255, 0.03)" : "#F8FAFC",
                        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                      }}
                    >
                      <p className="text-xs font-bold">{p.name}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-inherit">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Real-Time Transcription Feedback</p>
                    <p className="text-xs text-slate-400">Show live speech-to-text transcript while you answer</p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 accent-[#FF6B35] cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-inherit">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Strict Proctored Assessment Guard</p>
                    <p className="text-xs text-slate-400">Flag tab-switch and window defocus events during official tests</p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 accent-[#FF6B35] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
