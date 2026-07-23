import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, RotateCcw, Settings, Award, Shield, Bell, Eye, FileText } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

function SystemConfig() {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/api/system-config", { headers })
      .then(({ data }) => setConfigs(data || {}))
      .catch(() => toast.error("Failed to load config"))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (key, value) => {
    setConfigs(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/api/system-config", configs, { headers });
      toast.success("Configuration saved");
    } catch (err) { toast.error(err.response?.data?.message || "Save failed"); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    try {
      await api.post("/api/system-config/reset", {}, { headers });
      const { data } = await api.get("/api/system-config", { headers });
      setConfigs(data || {});
      toast.success("Config reset to defaults");
    } catch { toast.error("Reset failed"); }
  };

  const inputCls = "w-full px-3 py-2 text-sm border rounded-xl bg-transparent outline-none focus:ring-2 focus:ring-[var(--primary)]";
  const sectionCls = "border rounded-2xl p-5";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>System Configuration</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Manage global system settings</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className={sectionCls} style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Test Defaults</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                ["defaultTestDuration", "Default Duration (min)", "number", 30],
                ["defaultPassingMarks", "Default Passing Marks (%)", "number", 40],
                ["maxTestAttempts", "Max Attempts Per Test", "number", 3],
                ["defaultQuestionCount", "Default Questions", "number", 30],
                ["negativeMarkingEnabled", "Negative Marking", "checkbox", true],
                ["negativeMarkingValue", "Negative Value", "number", 0.25],
              ].map(([key, label, type, def]) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>
                  {type === "checkbox" ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={configs[key] ?? def} onChange={e => updateField(key, e.target.checked)}
                        className="w-4 h-4 rounded cursor-pointer" />
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Enabled</span>
                    </label>
                  ) : (
                    <input type={type} value={configs[key] ?? def} onChange={e => updateField(key, type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)} className={inputCls} style={{ color: "var(--text-primary)" }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={sectionCls} style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Branding</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["systemName", "System Name", "AI Interview Engine"],
                ["primaryColor", "Primary Color", "#2563EB"],
                ["logoUrl", "Logo URL", ""],
                ["faviconUrl", "Favicon URL", ""],
              ].map(([key, label, def]) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>
                  {key === "primaryColor" ? (
                    <div className="flex gap-2 items-center">
                      <input type="color" value={configs[key] || def} onChange={e => updateField(key, e.target.value)} className="w-10 h-9 rounded-xl border cursor-pointer" style={{ borderColor: "var(--border)" }} />
                      <input value={configs[key] || def} onChange={e => updateField(key, e.target.value)} className={`${inputCls} flex-1`} style={{ color: "var(--text-primary)" }} />
                    </div>
                  ) : (
                    <input value={configs[key] ?? def} onChange={e => updateField(key, e.target.value)} className={inputCls} style={{ color: "var(--text-primary)" }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={sectionCls} style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Notifications</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["emailNotifications", "Email Notifications", true],
                ["pushNotifications", "Push Notifications", true],
                ["assignmentNotify", "Test Assignment Notification", true],
                ["resultNotify", "Result Declaration Notification", true],
                ["reminderNotify", "Reminder Notifications", true],
                ["dailyDigest", "Daily Digest", false],
              ].map(([key, label, def]) => (
                <label key={key} className="flex items-center justify-between p-3 border rounded-xl cursor-pointer" style={{ borderColor: "var(--border)" }}>
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{label}</span>
                  <input type="checkbox" checked={configs[key] ?? def} onChange={e => updateField(key, e.target.checked)} className="w-4 h-4 rounded cursor-pointer" />
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-semibold text-white cursor-pointer disabled:opacity-50" style={{ background: "var(--primary)" }}>
              {saving ? "Saving..." : <><Save className="w-4 h-4" /> Save Configuration</>}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default SystemConfig;
