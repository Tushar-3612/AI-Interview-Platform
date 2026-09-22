import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Activity, CheckCircle, TrendingUp, Award, Building2,
  BrainCircuit, BarChart3, Filter, Search, Calendar, ChevronRight, RefreshCw
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import { useTheme } from "../../hooks/useTheme";
import toast from "react-hot-toast";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function AnalyticsDashboard() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState("overview");

  // Global Filters
  const [filters, setFilters] = useState({
    department: "",
    year: "",
    section: "",
    assessmentType: "all",
    startDate: "",
    endDate: "",
  });

  // State data
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [departmentData, setDepartmentData] = useState([]);
  const [studentPerf, setStudentPerf] = useState({ data: [], pagination: {} });
  const [studentSearch, setStudentSearch] = useState("");
  const [realInterviewData, setRealInterviewData] = useState(null);
  const [companyMockData, setCompanyMockData] = useState({ companies: [] });
  const [sectionData, setSectionData] = useState([]);
  const [distributionData, setDistributionData] = useState([]);
  const [timeData, setTimeData] = useState([]);

  const token = getAuthToken();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // Chart styling based on active theme
  const gridColor = isDark ? "#262B36" : "#ECECEC";
  const axisTextColor = isDark ? "#9CA3AF" : "#6B7280";
  const tooltipStyle = {
    backgroundColor: isDark ? "#171A21" : "#FFFFFF",
    borderColor: isDark ? "#262B36" : "#ECECEC",
    color: isDark ? "#F8F9FB" : "#111827",
    borderRadius: "12px",
    boxShadow: isDark ? "0 10px 30px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.08)",
    fontSize: "12px",
    fontWeight: 600,
  };

  const fetchAllAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.department) queryParams.append("department", filters.department);
      if (filters.year) queryParams.append("year", filters.year);
      if (filters.section) queryParams.append("section", filters.section);
      if (filters.startDate) queryParams.append("startDate", filters.startDate);
      if (filters.endDate) queryParams.append("endDate", filters.endDate);

      const [
        overviewRes,
        deptRes,
        realIntRes,
        compMockRes,
        secRes,
        distRes,
        timeRes,
      ] = await Promise.all([
        api.get("/api/admin/analytics/overview", { headers }).catch(() => null),
        api.get(`/api/admin/analytics/departments?${queryParams.toString()}`, { headers }).catch(() => null),
        api.get("/api/admin/analytics/real-interviews", { headers }).catch(() => null),
        api.get("/api/admin/analytics/company-mocks", { headers }).catch(() => null),
        api.get("/api/admin/analytics/sections", { headers }).catch(() => null),
        api.get("/api/admin/analytics/distribution", { headers }).catch(() => null),
        api.get("/api/admin/analytics/time-based", { headers }).catch(() => null),
      ]);

      if (overviewRes?.data?.success) setOverview(overviewRes.data.data);
      if (deptRes?.data?.success) setDepartmentData(deptRes.data.data || []);
      if (realIntRes?.data?.success) setRealInterviewData(realIntRes.data.data);
      if (compMockRes?.data?.success) setCompanyMockData(compMockRes.data.data || { companies: [] });
      if (secRes?.data?.success) setSectionData(secRes.data.data || []);
      if (distRes?.data?.success) setDistributionData(distRes.data.data || []);
      if (timeRes?.data?.success) setTimeData(timeRes.data.data || []);

    } catch {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [filters, headers]);

  const fetchStudents = useCallback(async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.department) queryParams.append("department", filters.department);
      if (filters.year) queryParams.append("year", filters.year);
      if (filters.section) queryParams.append("section", filters.section);
      if (studentSearch) queryParams.append("search", studentSearch);

      const res = await api.get(`/api/admin/analytics/students?${queryParams.toString()}`, { headers });
      if (res.data?.success) {
        setStudentPerf({ data: res.data.data, pagination: res.data.pagination });
      }
    } catch (err) {
      console.error(err);
    }
  }, [filters, studentSearch, headers]);

  useEffect(() => {
    fetchAllAnalytics();
  }, [fetchAllAnalytics]);

  useEffect(() => {
    if (activeTab === "students") {
      fetchStudents();
    }
  }, [activeTab, fetchStudents]);

  return (
    <div className="space-y-6 pb-12" style={{ color: "var(--text-primary)" }}>
      {/* Top Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Admin Analytics Dashboard
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Real-time performance overview and assessment activity calculated strictly from active database records.
          </p>
        </div>
        <button
          onClick={fetchAllAnalytics}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer w-fit shadow-sm active:scale-95"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Global Filter Bar */}
      <div
        className="p-4 rounded-2xl border flex flex-wrap items-center gap-3 shadow-sm transition-colors"
        style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--primary)" }}>
          <Filter className="w-4 h-4" />
          <span>Filters:</span>
        </div>

        <input
          type="text"
          placeholder="Department..."
          value={filters.department}
          onChange={(e) => setFilters({ ...filters, department: e.target.value })}
          className="px-3 py-1.5 text-xs rounded-xl border outline-none transition-colors w-32 focus:border-[var(--primary)]"
          style={{
            background: "var(--input-bg)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        />

        <input
          type="text"
          placeholder="Year..."
          value={filters.year}
          onChange={(e) => setFilters({ ...filters, year: e.target.value })}
          className="px-3 py-1.5 text-xs rounded-xl border outline-none transition-colors w-24 focus:border-[var(--primary)]"
          style={{
            background: "var(--input-bg)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        />

        <input
          type="text"
          placeholder="Section..."
          value={filters.section}
          onChange={(e) => setFilters({ ...filters, section: e.target.value })}
          className="px-3 py-1.5 text-xs rounded-xl border outline-none transition-colors w-24 focus:border-[var(--primary)]"
          style={{
            background: "var(--input-bg)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        />

        {(filters.department || filters.year || filters.section) && (
          <button
            onClick={() => setFilters({ department: "", year: "", section: "", assessmentType: "all", startDate: "", endDate: "" })}
            className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Overview Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          className="p-4 rounded-2xl border flex items-center gap-3.5 shadow-sm transition-colors"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "rgba(59, 130, 246, 0.12)",
              border: "1px solid rgba(59, 130, 246, 0.25)",
              color: "#3B82F6",
            }}
          >
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Total Students
            </p>
            <p className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
              {overview?.totalStudents ?? 0}
            </p>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl border flex items-center gap-3.5 shadow-sm transition-colors"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              color: "#10B981",
            }}
          >
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Active Students
            </p>
            <p className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
              {overview?.activeStudents ?? 0}
            </p>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl border flex items-center gap-3.5 shadow-sm transition-colors"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "rgba(139, 92, 246, 0.12)",
              border: "1px solid rgba(139, 92, 246, 0.25)",
              color: "#8B5CF6",
            }}
          >
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Completed Assessments
            </p>
            <p className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
              {overview?.completedAssessments ?? 0}
            </p>
          </div>
        </div>

        <div
          className="p-4 rounded-2xl border flex items-center gap-3.5 shadow-sm transition-colors"
          style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              color: "#F59E0B",
            }}
          >
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Average Score
            </p>
            <p className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
              {overview?.averageScore ?? 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b gap-2 overflow-x-auto pb-1" style={{ borderColor: "var(--border)" }}>
        {[
          { id: "overview", label: "Overview" },
          { id: "departments", label: "Department Analytics" },
          { id: "students", label: "Student Performance" },
          { id: "real_interview", label: "Real Interview Analytics" },
          { id: "company_mocks", label: "Company Mocks & Comparison" },
          { id: "distribution", label: "Section & Score Distribution" },
        ].map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border"
              style={{
                background: isActive ? "var(--primary)" : "var(--card-bg)",
                borderColor: isActive ? "var(--primary)" : "var(--border)",
                color: isActive ? "#FFFFFF" : "var(--text-secondary)",
                boxShadow: isActive ? "0 4px 14px rgba(255, 107, 53, 0.3)" : "none",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dept Performance Chart */}
            <div
              className="p-6 rounded-2xl border space-y-4 shadow-sm transition-colors"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            >
              <h3 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                Department Performance Overview
              </h3>
              {departmentData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="department" stroke={axisTextColor} fontSize={11} />
                      <YAxis stroke={axisTextColor} fontSize={11} domain={[0, 100]} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="averageScore" name="Avg Score %" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-xs" style={{ color: "var(--text-muted)" }}>
                  No data available
                </div>
              )}
            </div>

            {/* Time-based Attempt Trends */}
            <div
              className="p-6 rounded-2xl border space-y-4 shadow-sm transition-colors"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            >
              <h3 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                Assessment Activity Over Time
              </h3>
              {timeData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="date" stroke={axisTextColor} fontSize={11} />
                      <YAxis stroke={axisTextColor} fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="total" name="Total Attempts" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="completed" name="Completed" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-xs" style={{ color: "var(--text-muted)" }}>
                  No data available
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DEPARTMENT ANALYTICS */}
        {activeTab === "departments" && (
          <div
            className="p-6 rounded-2xl border space-y-4 shadow-sm transition-colors"
            style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
          >
            <h3 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Department-Wise Student Analytics
            </h3>
            {departmentData.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <table className="w-full text-xs text-left">
                  <thead
                    className="uppercase text-[10px] font-bold border-b"
                    style={{
                      background: "var(--bg-primary)",
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <tr>
                      <th className="p-3">Department</th>
                      <th className="p-3">Total Students</th>
                      <th className="p-3">Attempted</th>
                      <th className="p-3">Completed</th>
                      <th className="p-3">Avg Score %</th>
                      <th className="p-3">Highest %</th>
                      <th className="p-3">Lowest %</th>
                      <th className="p-3">Pass Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {departmentData.map((d, i) => (
                      <tr
                        key={i}
                        className="transition-colors hover:bg-[var(--admin-surface-hover)]"
                      >
                        <td className="p-3 font-bold" style={{ color: "var(--text-primary)" }}>{d.department}</td>
                        <td className="p-3" style={{ color: "var(--text-secondary)" }}>{d.totalStudents}</td>
                        <td className="p-3" style={{ color: "var(--text-secondary)" }}>{d.studentsAttempted}</td>
                        <td className="p-3" style={{ color: "var(--text-secondary)" }}>{d.studentsCompleted}</td>
                        <td className="p-3 font-bold text-blue-500">{d.averageScore}%</td>
                        <td className="p-3 font-semibold text-emerald-500">{d.highestScore}%</td>
                        <td className="p-3 font-semibold text-rose-500">{d.lowestScore}%</td>
                        <td className="p-3">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                            style={{
                              background: "rgba(59, 130, 246, 0.1)",
                              color: "#3B82F6",
                              borderColor: "rgba(59, 130, 246, 0.25)",
                            }}
                          >
                            {d.passRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                No data available
              </div>
            )}
          </div>
        )}

        {/* TAB 3: STUDENT PERFORMANCE */}
        {activeTab === "students" && (
          <div
            className="p-6 rounded-2xl border space-y-4 shadow-sm transition-colors"
            style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
          >
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <h3 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                Student Performance Analytics
              </h3>
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Search student name or email..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border outline-none transition-colors focus:border-[var(--primary)]"
                  style={{
                    background: "var(--input-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            {studentPerf.data.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <table className="w-full text-xs text-left">
                  <thead
                    className="uppercase text-[10px] font-bold border-b"
                    style={{
                      background: "var(--bg-primary)",
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <tr>
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Department</th>
                      <th className="p-3">Year / Sec</th>
                      <th className="p-3">Total Attempts</th>
                      <th className="p-3">Completed</th>
                      <th className="p-3">Avg Score %</th>
                      <th className="p-3">Best Score</th>
                      <th className="p-3">Latest Assessment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {studentPerf.data.map((s, i) => (
                      <tr
                        key={i}
                        className="transition-colors hover:bg-[var(--admin-surface-hover)]"
                      >
                        <td className="p-3 font-bold" style={{ color: "var(--text-primary)" }}>
                          <div>{s.name}</div>
                          <div className="text-[10px] font-normal" style={{ color: "var(--text-muted)" }}>{s.email}</div>
                        </td>
                        <td className="p-3" style={{ color: "var(--text-secondary)" }}>{s.department}</td>
                        <td className="p-3" style={{ color: "var(--text-muted)" }}>{s.year} - {s.section}</td>
                        <td className="p-3 font-semibold" style={{ color: "var(--text-primary)" }}>{s.totalAttempts}</td>
                        <td className="p-3" style={{ color: "var(--text-secondary)" }}>{s.completedAttempts}</td>
                        <td className="p-3 font-bold text-blue-500">{s.averageScore}%</td>
                        <td className="p-3 font-semibold text-emerald-500">{s.bestScore}%</td>
                        <td className="p-3" style={{ color: "var(--text-muted)" }}>
                          {s.latestAssessment ? `${s.latestAssessment.title}` : "None"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                No data available
              </div>
            )}
          </div>
        )}

        {/* TAB 4: REAL INTERVIEW ANALYTICS (READ-ONLY) */}
        {activeTab === "real_interview" && (
          <div className="space-y-6">
            <div
              className="p-4 rounded-xl border text-xs font-semibold"
              style={{
                background: isDark ? "rgba(245, 158, 11, 0.12)" : "#FEF3C7",
                borderColor: isDark ? "rgba(245, 158, 11, 0.25)" : "#FDE68A",
                color: isDark ? "#FCD34D" : "#B45309",
              }}
            >
              IMPORTANT: Real Interview Analytics is strictly READ-ONLY. The Real Interview engine is untouched.
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl border shadow-sm transition-colors" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Total Real Sessions</p>
                <p className="text-xl font-extrabold mt-1" style={{ color: "var(--text-primary)" }}>{realInterviewData?.totalSessions ?? 0}</p>
              </div>

              <div className="p-4 rounded-2xl border shadow-sm transition-colors" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Completed Interviews</p>
                <p className="text-xl font-extrabold mt-1 text-emerald-500">{realInterviewData?.completedInterviews ?? 0}</p>
              </div>

              <div className="p-4 rounded-2xl border shadow-sm transition-colors" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Completion Rate</p>
                <p className="text-xl font-extrabold mt-1 text-blue-500">{realInterviewData?.completionRate ?? 0}%</p>
              </div>

              <div className="p-4 rounded-2xl border shadow-sm transition-colors" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Average Score</p>
                <p className="text-xl font-extrabold mt-1 text-purple-500">{realInterviewData?.averageInterviewScore ?? 0}%</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: COMPANY MOCKS & COMPARISON */}
        {activeTab === "company_mocks" && (
          <div
            className="p-6 rounded-2xl border space-y-4 shadow-sm transition-colors"
            style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
          >
            <h3 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Company Mock Performance & Comparison Matrix
            </h3>
            {companyMockData.companies?.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <table className="w-full text-xs text-left">
                  <thead
                    className="uppercase text-[10px] font-bold border-b"
                    style={{
                      background: "var(--bg-primary)",
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <tr>
                      <th className="p-3">Company</th>
                      <th className="p-3">Students Attempted</th>
                      <th className="p-3">Total Attempts</th>
                      <th className="p-3">Completed</th>
                      <th className="p-3">Avg Score %</th>
                      <th className="p-3">Highest %</th>
                      <th className="p-3">Lowest %</th>
                      <th className="p-3">Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {companyMockData.companies.map((c, i) => (
                      <tr
                        key={i}
                        className="transition-colors hover:bg-[var(--admin-surface-hover)]"
                      >
                        <td className="p-3 font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                          <Building2 className="w-4 h-4 text-blue-500" />
                          <span>{c.companyName}</span>
                        </td>
                        <td className="p-3 font-semibold" style={{ color: "var(--text-secondary)" }}>{c.studentsCount}</td>
                        <td className="p-3" style={{ color: "var(--text-secondary)" }}>{c.totalAttempts}</td>
                        <td className="p-3" style={{ color: "var(--text-secondary)" }}>{c.completedAttempts}</td>
                        <td className="p-3 font-bold text-blue-500">{c.averagePercentage}%</td>
                        <td className="p-3 text-emerald-500 font-semibold">{c.highestPercentage}%</td>
                        <td className="p-3 text-rose-500 font-semibold">{c.lowestPercentage}%</td>
                        <td className="p-3">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                            style={{
                              background: "rgba(16, 185, 129, 0.1)",
                              color: "#10B981",
                              borderColor: "rgba(16, 185, 129, 0.25)",
                            }}
                          >
                            {c.completionRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                No data available
              </div>
            )}
          </div>
        )}

        {/* TAB 6: SECTION & SCORE DISTRIBUTION */}
        {activeTab === "distribution" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div
              className="p-6 rounded-2xl border space-y-4 shadow-sm transition-colors"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            >
              <h3 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                Mock Section Performance
              </h3>
              {sectionData.length > 0 ? (
                <div className="space-y-4">
                  {sectionData.map((sec, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl border flex items-center justify-between transition-colors"
                      style={{
                        background: "var(--bg-primary)",
                        borderColor: "var(--border)",
                      }}
                    >
                      <div>
                        <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{sec.name} Section</p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Total Attempts: {sec.attempts}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-extrabold text-blue-500">{sec.averageScore}%</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Avg Score</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                  No data available
                </div>
              )}
            </div>

            <div
              className="p-6 rounded-2xl border space-y-4 shadow-sm transition-colors"
              style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
            >
              <h3 className="text-sm font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                Overall Score Distribution
              </h3>
              {distributionData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="range" stroke={axisTextColor} fontSize={11} />
                      <YAxis stroke={axisTextColor} fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" name="Student Count" fill="#10B981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="p-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                  No data available
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
