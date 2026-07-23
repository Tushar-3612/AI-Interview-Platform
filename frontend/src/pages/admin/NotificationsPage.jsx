import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, Trash2, Mail, UserCheck, AlertTriangle, Award, X } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

const TYPE_ICONS = { test_assigned: Mail, result_declared: Award, reminder: AlertTriangle, system: Bell, welcome: UserCheck };

function NotificationsPage() {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/notifications", { headers });
      setNotifications(data || []);
    } catch { toast.error("Failed to load notifications"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const markAsRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`, {}, { headers });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch { toast.error("Failed to mark as read"); }
  };

  const markAllRead = async () => {
    try {
      await api.put("/api/notifications/read-all", {}, { headers });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success("All marked as read");
    } catch { toast.error("Failed"); }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/api/notifications/${id}`, { headers });
      setNotifications(prev => prev.filter(n => n._id !== id));
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  const filtered = filter === "all" ? notifications : filter === "unread" ? notifications.filter(n => !n.read) : notifications.filter(n => n.type === filter);
  const unreadCount = notifications.filter(n => !n.read).length;

  const filterBtn = (label, value) => (
    <button onClick={() => setFilter(value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${filter === value ? "text-white" : ""}`}
      style={{ background: filter === value ? "var(--primary)" : "transparent", color: filter === value ? "white" : "var(--text-secondary)" }}>{label}</button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Notifications</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>Stay updated with system activity</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer" style={{ color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
            <CheckCheck className="w-3.5 h-3.5" /> Mark All Read
          </button>
        )}
      </div>

      <div className="flex gap-2 px-1">{filterBtn("All", "all")}{filterBtn("Unread", "unread")}{filterBtn("Tests", "test_assigned")}{filterBtn("Results", "result_declared")}{filterBtn("Reminders", "reminder")}{filterBtn("System", "system")}</div>

      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border rounded-2xl" style={{ borderColor: "var(--border)" }}>
            <Bell className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{filter === "unread" ? "No unread notifications" : "No notifications yet"}</p>
          </div>
        ) : filtered.map((n, i) => {
          const Icon = TYPE_ICONS[n.type] || Bell;
          return (
            <motion.div key={n._id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              className={`flex items-start gap-3 p-4 border rounded-2xl ${!n.read ? "border-l-[3px]" : ""}`}
              style={{ borderColor: !n.read ? "var(--primary)" : "var(--border)", background: "var(--card-bg)", borderLeftColor: !n.read ? "var(--primary)" : "var(--border)" }}>
              <div className={`p-2 rounded-xl ${!n.read ? "text-white" : ""}`}
                style={{ background: !n.read ? "var(--primary)" : "color-mix(in srgb, var(--primary) 8%, transparent)", color: !n.read ? "white" : "var(--primary)" }}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{n.title}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{n.message}</p>
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {!n.read && <button onClick={() => markAsRead(n._id)} className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--primary)" }} title="Mark read"><CheckCheck className="w-3.5 h-3.5" /></button>}
                <button onClick={() => deleteNotification(n._id)} className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-muted)" }} title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default NotificationsPage;
