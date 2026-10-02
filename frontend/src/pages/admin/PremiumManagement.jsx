import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Search, UserCheck, Zap,
  X, AlertTriangle, RefreshCw, UserMinus, PlusCircle, Sparkles, Check
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

export default function PremiumManagement() {
  const [premiumUsers, setPremiumUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Grant Modal State
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [grantingId, setGrantingId] = useState(null);

  // Revoke Confirm Modal State
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  const fetchPremiumData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${getAuthToken()}` };
      const [listRes, statsRes] = await Promise.all([
        api.get("/api/admin/premium/users", {
          headers,
          params: { search, page, limit: 10 },
        }),
        api.get("/api/admin/premium/stats", { headers }),
      ]);

      const userList = listRes.data?.users || listRes.data?.students || [];
      setPremiumUsers(userList);
      setPages(listRes.data?.pagination?.pages || listRes.data?.pages || 1);
      setTotal(listRes.data?.pagination?.total ?? listRes.data?.total ?? userList.length);
      setStats(statsRes.data || null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load premium users");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchPremiumData();
  }, [fetchPremiumData]);

  // Search candidate students to grant premium
  const handleStudentSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const query = studentSearch.trim();
    if (!query) {
      setSearchResults([]);
      setSearchPerformed(false);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    setSearchPerformed(true);
    try {
      console.log("[Premium Search] request", { query });
      const headers = { Authorization: `Bearer ${getAuthToken()}` };
      const { data } = await api.get("/api/admin/premium/search", {
        headers,
        params: { query },
      });
      console.log("[Premium Search] response", data);
      const results = data?.students || data?.users || [];
      setSearchResults(results);
    } catch (err) {
      console.error("[Premium Search] error", err);
      const status = err.response?.status;
      let errMsg = "Unable to search students. Please try again.";
      if (status === 403) {
        errMsg = "You are not authorized to search students.";
      } else if (status === 404) {
        errMsg = "Search endpoint not found.";
      } else if (err.response?.data?.message) {
        errMsg = err.response.data.message;
      }
      setSearchError(errMsg);
      toast.error(errMsg);
    } finally {
      setSearching(false);
    }
  };

  const handleGrantPremium = async (student) => {
    setGrantingId(student._id);
    try {
      const headers = { Authorization: `Bearer ${getAuthToken()}` };
      const { data } = await api.post(
        "/api/admin/premium/grant",
        { userId: student._id, studentId: student._id },
        { headers }
      );
      toast.success(data.message || `Premium membership granted to ${student.name}!`);
      // Update local search results
      setSearchResults((prev) =>
        prev.map((s) => (s._id === student._id ? { ...s, isPremium: true } : s))
      );
      // Refresh background data
      fetchPremiumData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to grant premium");
    } finally {
      setGrantingId(null);
    }
  };

  const handleRevokePremium = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const headers = { Authorization: `Bearer ${getAuthToken()}` };
      const { data } = await api.post(
        "/api/admin/premium/revoke",
        { userId: revokeTarget._id },
        { headers }
      );
      toast.success(data.message || `Premium revoked from ${revokeTarget.name}`);
      setRevokeTarget(null);
      // Update local search results if open
      setSearchResults((prev) =>
        prev.map((s) => (s._id === revokeTarget._id ? { ...s, isPremium: false } : s))
      );
      fetchPremiumData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to revoke premium");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              System Admin Only
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Premium Membership Management
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Grant or revoke platform-wide Pro candidate privileges, unlimited AI mock interviews, and advanced analytics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPremiumData}
            className="p-2.5 rounded-xl border bg-[var(--card-bg)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] cursor-pointer"
            style={{ borderColor: "var(--border)" }}
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setGrantModalOpen(true);
              setStudentSearch("");
              setSearchResults([]);
              setSearchError(null);
              setSearchPerformed(false);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:opacity-90 shadow-md cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Grant Premium
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border bg-[var(--card-bg)] flex items-center gap-3.5" style={{ borderColor: "var(--border)" }}>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-[var(--text-primary)]">{stats.totalPremium}</div>
              <div className="text-xs text-[var(--text-secondary)]">Active Premium Members</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl border bg-[var(--card-bg)] flex items-center gap-3.5" style={{ borderColor: "var(--border)" }}>
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-[var(--text-primary)]">{stats.totalStudents}</div>
              <div className="text-xs text-[var(--text-secondary)]">Total Registered Students</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl border bg-[var(--card-bg)] flex items-center gap-3.5" style={{ borderColor: "var(--border)" }}>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-[var(--text-primary)]">{stats.premiumPercentage}%</div>
              <div className="text-xs text-[var(--text-secondary)]">Platform Premium Ratio</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Search & Table ── */}
      <div className="p-4 rounded-2xl border bg-[var(--card-bg)] flex items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Filter premium members by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs border bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <span className="text-xs text-[var(--text-muted)]">{total} Members Listed</span>
      </div>

      <div className="rounded-2xl border overflow-hidden bg-[var(--card-bg)] shadow-xs" style={{ borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b bg-[var(--bg-secondary)]" style={{ borderColor: "var(--border)" }}>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)]">Candidate</th>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)]">Email</th>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)]">Department</th>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)]">Year</th>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)]">Granted Date</th>
                <th className="px-5 py-3.5 font-semibold text-[var(--text-secondary)] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[var(--text-muted)]">
                    <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading premium members...
                  </td>
                </tr>
              ) : premiumUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[var(--text-muted)]">
                    <Crown className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-500" />
                    <p className="font-semibold text-sm text-[var(--text-primary)] mb-1">No Premium Members Found</p>
                    <p className="text-xs text-[var(--text-secondary)] mb-3">Click <strong>Grant Premium</strong> above to upgrade any registered student.</p>
                  </td>
                </tr>
              ) : (
                premiumUsers.map((user) => (
                  <tr key={user._id} className="hover:bg-[var(--bg-secondary)]/50 transition-colors">
                    <td className="px-5 py-4 font-semibold text-[var(--text-primary)]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center text-xs">
                          {user.name?.charAt(0)?.toUpperCase() || "S"}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            {user.name}
                            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[var(--text-secondary)] font-mono text-[11px]">
                      {user.email}
                    </td>
                    <td className="px-5 py-4 text-[var(--text-primary)] font-medium">
                      {user.department || "General"}
                    </td>
                    <td className="px-5 py-4 text-[var(--text-secondary)]">
                      {user.year || "—"}
                    </td>
                    <td className="px-5 py-4 text-[var(--text-muted)] text-[11px]">
                      {user.premiumGrantedAt
                        ? new Date(user.premiumGrantedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Active"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setRevokeTarget(user)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-red-500/20 text-red-600 hover:bg-red-500/10 cursor-pointer transition-colors"
                      >
                        <UserMinus className="w-3.5 h-3.5" /> Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── GRANT PREMIUM MODAL ── */}
      <AnimatePresence>
        {grantModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg p-6 rounded-2xl border bg-[var(--card-bg)] shadow-2xl space-y-4"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-500" />
                  <h2 className="text-base font-bold text-[var(--text-primary)]">Grant Premium Membership</h2>
                </div>
                <button onClick={() => setGrantModalOpen(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleStudentSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search candidate by name, email, or department..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs border bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]"
                    style={{ borderColor: "var(--border)" }}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {searching ? "Searching..." : "Search"}
                </button>
              </form>

              <div className="max-h-72 overflow-y-auto divide-y border rounded-xl" style={{ borderColor: "var(--border)" }}>
                {searching ? (
                  <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                    <div className="w-5 h-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Searching registered students...
                  </div>
                ) : searchError ? (
                  <div className="p-6 text-center text-xs text-red-500 bg-red-500/5 flex flex-col items-center justify-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <span>{searchError}</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                    {searchPerformed && studentSearch.trim()
                      ? "No registered students found matching your search term."
                      : "Type a student name or email and click Search to find candidates."}
                  </div>
                ) : (
                  searchResults.map((student) => (
                    <div key={student._id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-[var(--bg-secondary)]/50 transition-colors">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 truncate">
                          {student.name}
                          {student.isPremium && <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] font-mono truncate">{student.email}</div>
                        <div className="text-[10px] text-[var(--text-muted)] truncate">{student.department} • Year: {student.year}</div>
                      </div>
                      <div className="shrink-0">
                        {student.isPremium ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Check className="w-3 h-3" /> Pro
                          </span>
                        ) : (
                          <button
                            onClick={() => handleGrantPremium(student)}
                            disabled={grantingId === student._id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
                          >
                            <Crown className="w-3.5 h-3.5" />
                            {grantingId === student._id ? "Granting..." : "Grant Pro"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setGrantModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── REVOKE CONFIRM MODAL ── */}
      <AnimatePresence>
        {revokeTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-2xl border bg-[var(--card-bg)] shadow-2xl space-y-4"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Revoke Premium Access?</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Demote candidate to standard tier.</p>
                </div>
              </div>

              <p className="text-xs text-[var(--text-muted)]">
                Are you sure you want to revoke premium membership from <strong>{revokeTarget.name}</strong> ({revokeTarget.email})?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRevokeTarget(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border bg-transparent text-[var(--text-secondary)] cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={revoking}
                  onClick={handleRevokePremium}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                >
                  {revoking ? "Revoking..." : "Revoke Premium"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
