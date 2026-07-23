import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Upload, Database, FileSpreadsheet, History, HardDrive, Clock, Users, CheckCircle } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

function BackupDashboard() {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    api.get("/api/backup/history", { headers })
      .then(({ data }) => setBackups(data || []))
      .catch(() => toast.error("Failed to load backup history"))
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get("/api/backup/export", { headers, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url; a.download = `backup-${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click(); window.URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
      const { data } = await api.get("/api/backup/history", { headers });
      setBackups(data || []);
    } catch (err) { toast.error(err.response?.data?.message || "Export failed"); }
    finally { setExporting(false); }
  };

  const handleRestore = async () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".xlsx";
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      setRestoring(true);
      try {
        const formData = new FormData(); formData.append("backup", file);
        await api.post("/api/backup/restore", formData, { headers, timeout: 120000 });
        toast.success("Backup restored successfully");
      } catch (err) { toast.error("Restore failed"); }
      finally { setRestoring(false); }
    };
    input.click();
  };

  const stats = [
    { label: "Available Backups", value: backups.length, icon: Database, color: "var(--primary)" },
    { label: "Last Backup", value: backups.length > 0 ? new Date(backups[0].createdAt).toLocaleDateString() : "Never", icon: Clock, color: "#f59e0b" },
    { label: "Total Size", value: backups.length > 0 ? `${(backups.reduce((s, b) => s + (b.size || 0), 0) / 1024 / 1024).toFixed(1)} MB` : "0 MB", icon: HardDrive, color: "var(--success)" },
    { label: "Collections", value: "4", icon: Users, color: "var(--text-primary)" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Backup & Restore</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Export or restore database backup</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="border rounded-xl p-4" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4" style={{ color }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
            </div>
            <p className="text-lg font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div whileHover={{ scale: 1.01 }} className="border rounded-2xl p-6 text-center cursor-pointer" style={{ borderColor: "var(--border)" }} onClick={handleExport}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)" }}>
            <Download className="w-7 h-7" style={{ color: "var(--primary)" }} />
          </div>
          <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>Export Backup</h3>
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>Download all data as Excel file</p>
          <button disabled={exporting} className="px-5 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {exporting ? "Exporting..." : "Download Backup"}
          </button>
          <div className="mt-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
            <span className="inline-flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Users · Tests · Attempts · Results</span>
          </div>
        </motion.div>

        <motion.div whileHover={{ scale: 1.01 }} className="border rounded-2xl p-6 text-center" style={{ borderColor: "var(--border)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "color-mix(in srgb, #f59e0b 10%, transparent)" }}>
            <Upload className="w-7 h-7" style={{ color: "#f59e0b" }} />
          </div>
          <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>Restore Backup</h3>
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>Upload a previously exported backup</p>
          <button disabled={restoring} onClick={handleRestore} className="px-5 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer disabled:opacity-50" style={{ background: "#f59e0b" }}>
            {restoring ? "Restoring..." : "Upload & Restore"}
          </button>
          <div className="mt-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
            <span className="inline-flex items-center gap-1"><FileSpreadsheet className="w-3 h-3" /> Supports .xlsx format only</span>
          </div>
        </motion.div>
      </div>

      <div className="border rounded-2xl" style={{ borderColor: "var(--border)" }}>
        <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Backup History</h3>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
        ) : backups.length === 0 ? (
          <div className="text-center py-10"><Database className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} /><p className="text-xs" style={{ color: "var(--text-muted)" }}>No backups yet</p></div>
        ) : (
          <div>{backups.map((b, i) => (
            <div key={b._id || i} className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-4 h-4" style={{ color: "var(--success)" }} />
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{b.filename || `Backup ${i + 1}`}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{b.size ? `${(b.size / 1024 / 1024).toFixed(2)} MB` : ""} · {b.collections?.length || 4} collections</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{b.createdAt ? new Date(b.createdAt).toLocaleString() : ""}</span>
                {b.status && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.status === "completed" ? "text-green-600 bg-green-50 dark:bg-green-900/20" : "text-red-500 bg-red-50 dark:bg-red-900/20"}`}>{b.status}</span>}
              </div>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}

export default BackupDashboard;
