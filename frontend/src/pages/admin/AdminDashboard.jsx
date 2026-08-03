import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  BarChart3,
  CheckCircle2,
  TrendingUp,
  Download,
  RefreshCw,
  LogOut,
  Shield,
  Award,
  Search,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  Star,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../utils/api";

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ScoreBar({ score }) {
  const color =
    score >= 70
      ? "#22c55e"
      : score >= 50
      ? "#f59e0b"
      : "#ef4444";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold w-8 text-right" style={{ color }}>
        {score}%
      </span>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm"
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <p className="text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
        {value ?? "—"}
      </p>
      <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [results, setResults] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

  /* ── Fetch all admin data ── */
  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, usersRes, resultsRes] = await Promise.all([
          api.get("/api/admin/stats"),
          api.get("/api/admin/users"),
          api.get("/api/admin/results"),
        ]);
        setStats(statsRes.data);
        setUsers(usersRes.data);
        setResults(resultsRes.data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load admin data");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  /* ── Logout ── */
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("student-profile");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    navigate("/");
  };

  /* ── CSV Download ── */
  const handleDownloadCSV = async (type) => {
    const toastId = toast.loading(`Generating ${type}.csv...`);
    try {
      const res = await api.get(`/api/admin/export/${type}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${type}.csv downloaded!`, { id: toastId });
    } catch {
      toast.error("Download failed", { id: toastId });
    }
  };

  /* ── Sync CSV ── */
  const handleSyncCSV = async () => {
    setIsSyncing(true);
    try {
      await api.post("/api/admin/sync");
      toast.success("All CSV exports synced successfully!");
    } catch {
      toast.error("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  /* ── Sort columns ── */
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 inline-block ml-0.5" />
    ) : (
      <ChevronDown className="w-3 h-3 inline-block ml-0.5" />
    );
  };

  /* ── Filtered + sorted users ── */
  const filteredUsers = [...users]
    .filter(
      (u) =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.department?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });

  /* ── Filtered results ── */
  const filteredResults = [...results].filter((r) => {
    const name = r.userId?.name || "";
    const email = r.userId?.email || "";
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      email.toLowerCase().includes(search.toLowerCase())
    );
  });

  /* ─── LOADING ─── */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-slate-500">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  /* ─── RENDER ─── */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">

      {/* ── TOP NAVBAR ── */}
      <header className="sticky top-0 z-50 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-none">
                Admin Panel
              </h1>
              <p className="text-[10px] text-slate-400">Sanjivani AI Interview Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncCSV}
              disabled={isSyncing}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              Sync CSV
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/50 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── STATS GRID ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Students" value={stats?.totalUsers} icon={Users} color="#6366f1" delay={0} />
          <StatCard title="Total Interviews" value={stats?.totalInterviews} icon={BarChart3} color="#0ea5e9" delay={0.05} />
          <StatCard title="Completed" value={stats?.completedInterviews} icon={CheckCircle2} color="#22c55e" delay={0.1} />
          <StatCard title="Avg. Score" value={stats?.avgScore !== undefined ? `${stats.avgScore}%` : "—"} icon={TrendingUp} color="#f59e0b" delay={0.15} />
        </section>

        {/* ── CSV EXPORT BUTTONS ── */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 mb-8 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-4">
            Export Data
          </h2>
          <div className="flex flex-wrap gap-2">
            {["users", "interviews", "answers", "results"].map((type) => (
              <button
                key={type}
                onClick={() => handleDownloadCSV(type)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {type.charAt(0).toUpperCase() + type.slice(1)} CSV
              </button>
            ))}
          </div>
        </section>

        {/* ── TABS ── */}
        <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl w-fit mb-6">
          {[
            { id: "overview", label: "Students" },
            { id: "results", label: "Results" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearch(""); }}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── SEARCH ── */}
        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === "overview" ? "Search students..." : "Search results..."}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>

        {/* ── STUDENTS TABLE ── */}
        {activeTab === "overview" && (
          <motion.div
            key="students"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Registered Students
                <span className="ml-2 text-xs font-normal text-slate-400">
                  ({filteredUsers.length})
                </span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
                    {[
                      { key: "name", label: "Name" },
                      { key: "email", label: "Email" },
                      { key: "department", label: "Dept." },
                      { key: "year", label: "Year" },
                      { key: "completedCount", label: "Completed" },
                      { key: "createdAt", label: "Joined" },
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 dark:hover:text-zinc-200 whitespace-nowrap"
                      >
                        {label}
                        <SortIcon col={key} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user, i) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 bg-gradient-to-br from-violet-500 to-indigo-600">
                              {user.name?.[0]?.toUpperCase() || "S"}
                            </div>
                            <span className="font-medium text-slate-800 dark:text-zinc-200 truncate max-w-[150px]">
                              {user.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-zinc-400 truncate max-w-[200px]">
                          {user.email}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                          {user.department || "—"}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-zinc-400 whitespace-nowrap">
                          {user.year || "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                              user.completedCount > 0
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {user.completedCount > 0 && <CheckCircle2 className="w-3 h-3" />}
                            {user.completedCount} / {user.interviewCount}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 dark:text-zinc-500 whitespace-nowrap text-xs">
                          {formatDate(user.createdAt)}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ── RESULTS TABLE ── */}
        {activeTab === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Interview Results
                <span className="ml-2 text-xs font-normal text-slate-400">
                  ({filteredResults.length})
                </span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
                    {["Student", "Dept.", "Overall", "Technical", "Resume", "Recommendation", "Date"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        No results found.
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((result, i) => {
                      const isGood = result.overallScore >= 70;
                      return (
                        <motion.tr
                          key={result._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 bg-gradient-to-br from-violet-500 to-indigo-600">
                                {result.userId?.name?.[0]?.toUpperCase() || "S"}
                              </div>
                              <div>
                                <p className="font-medium text-slate-800 dark:text-zinc-200 truncate max-w-[130px]">
                                  {result.userId?.name || "Unknown"}
                                </p>
                                <p className="text-xs text-slate-400 truncate max-w-[130px]">
                                  {result.userId?.email || ""}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-slate-600 dark:text-zinc-400 whitespace-nowrap text-xs">
                            {result.userId?.department || "—"}
                          </td>
                          <td className="px-5 py-3.5 min-w-[140px]">
                            <ScoreBar score={result.overallScore ?? 0} />
                          </td>
                          <td className="px-5 py-3.5 min-w-[140px]">
                            <ScoreBar score={result.technicalScore ?? 0} />
                          </td>
                          <td className="px-5 py-3.5 min-w-[140px]">
                            <ScoreBar score={result.resumeScore ?? 0} />
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                                isGood
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              }`}
                            >
                              {isGood && <Star className="w-3 h-3" />}
                              {result.recommendation || "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 dark:text-zinc-500 whitespace-nowrap text-xs">
                            {formatDate(result.createdAt)}
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
