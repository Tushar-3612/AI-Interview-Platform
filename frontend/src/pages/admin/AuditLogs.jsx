import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Activity, Shield, Search, Calendar, Users, FileText, Settings, LogIn , Bell} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

const RESOURCE_ICONS = { test: FileText, user: Users, company: Shield, config: Settings, auth: LogIn, email: Activity, notification: Bell };

function AuditLogs() {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ resource: "", action: "", status: "", days: 7 });
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, uniqueUsers: 0 });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/audit-logs", { params: filters, headers });
      setLogs(data.logs || []);
      setStats({ total: data.total || 0, success: data.successCount || 0, failed: data.failedCount || 0, uniqueUsers: data.uniqueUsers || 0 });
    } catch { toast.error("Failed to load audit logs"); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Audit Logs</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Track all system activities</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[["Total Actions", stats.total, "var(--primary)"], ["Successful", stats.success, "var(--success)"], ["Failed", stats.failed, "var(--error)"], ["Active Users", stats.uniqueUsers, "#f59e0b"]].map(([l, v, c]) => (
          <div key={l} className="border rounded-xl p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{l}</p>
            <p className="text-xl font-bold" style={{ color: c }}>{v}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select value={filters.resource} onChange={e => setFilters({ ...filters, resource: e.target.value })} className="px-3 py-2 text-xs border rounded-xl bg-transparent outline-none cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          <option value="">All Resources</option>
          <option value="test">Test</option>
          <option value="user">User</option>
          <option value="company">Company</option>
          <option value="config">Config</option>
          <option value="email">Email</option>
          <option value="auth">Auth</option>
        </select>
        <select value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })} className="px-3 py-2 text-xs border rounded-xl bg-transparent outline-none cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="read">Read</option>
          <option value="login">Login</option>
          <option value="send">Send</option>
        </select>
        <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="px-3 py-2 text-xs border rounded-xl bg-transparent outline-none cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          <option value="">All Status</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
        <select value={filters.days} onChange={e => setFilters({ ...filters, days: parseInt(e.target.value) })} className="px-3 py-2 text-xs border rounded-xl bg-transparent outline-none cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          <option value={1}>Last 24h</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="border rounded-2xl" style={{ borderColor: "var(--border)" }}>
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <Activity className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No audit logs found</p>
          </div>
        ) : (
          <div>{logs.map((log, i) => {
            const Icon = RESOURCE_ICONS[log.resource] || Activity;
            return (
              <motion.div key={log._id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className={`p-2 rounded-lg ${log.status === "success" ? "text-green-500 bg-green-50 dark:bg-green-900/20" : "text-red-500 bg-red-50 dark:bg-red-900/20"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{log.action}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)", color: "var(--primary)" }}>{log.resource}</span>
                    <span className={`text-[10px] font-semibold ${log.status === "success" ? "text-green-600" : "text-red-500"}`}>{log.status}</span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {log.userId?.name || log.userId?.email || "System"} · {log.ip || "N/A"} · {new Date(log.createdAt).toLocaleString()}
                  </p>
                  {log.details && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{typeof log.details === "string" ? log.details : JSON.stringify(log.details)}</p>}
                </div>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{log.duration ? `${log.duration}ms` : ""}</span>
              </motion.div>
            );
          })}</div>
        )}
      </div>
    </div>
  );
}

export default AuditLogs;
