import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Mail, UserCheck, AlertTriangle, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";

const TYPE_ICONS = { test_assigned: Mail, result_declared: Award, reminder: AlertTriangle, system: Bell, welcome: UserCheck };

function NotificationBell() {
  const token = getAuthToken();
  const headers = { Authorization: `Bearer ${token}` };
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get("/api/notifications?limit=5", {
          headers,
        });

        setNotifications(data.notifications || []);
      } catch { }
    };
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`, {}, { headers });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    } catch { }
  };
const unreadCount = notifications.reduce(
  (count, n) => count + (!n.read ? 1 : 0),
  0
);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-xl border cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white rounded-full" style={{ background: "var(--error)" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 border rounded-2xl shadow-xl z-50 overflow-hidden" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <h4 className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Notifications</h4>
            <button onClick={() => { setOpen(false); navigate("/admin/notifications"); }} className="text-[10px] font-medium cursor-pointer" style={{ color: "var(--primary)" }}>View All</button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center py-6 text-xs" style={{ color: "var(--text-muted)" }}>No notifications</p>
            ) : notifications.map((n) => {
              const Icon = TYPE_ICONS[n.type] || Bell;
              return (
                <div key={n._id} className={`flex items-start gap-3 px-4 py-3 border-b cursor-pointer ${!n.read ? "" : ""}`}
                  style={{ borderColor: "var(--border)", background: !n.read ? "color-mix(in srgb, var(--primary) 4%, transparent)" : "transparent" }}
                  onClick={() => { if (!n.read) markRead(n._id); }}>
                  <div className="p-1.5 rounded-lg shrink-0" style={{ color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{n.title}</p>
                    <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{n.message}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: "var(--primary)" }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
