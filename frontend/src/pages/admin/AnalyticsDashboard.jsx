import { useState, useEffect, useCallback } from "react";
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
import toast from "react-hot-toast";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function AnalyticsDashboard() {
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
  const headers = { Authorization: `Bearer ${token}` };

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

    } catch (err) {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
  }, [filters, studentSearch]);

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
          <h1 className="text-xl font-bold tracking-tight">Admin Analytics Dashboard</h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Real-time performance overview and assessment activity calculated strictly from active database records.
          </p>
        </div>
        <button
          onClick={fetchAllAnalytics}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border bg-slate-800/60 hover:bg-slate-700/60 transition-all cursor-pointer w-fit"
          style={{ borderColor: "var(--border)" }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Global Filter Bar */}
      <div className="p-4 rounded-2xl border flex flex-wrap items-center gap-3" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
          <Filter className="w-4 h-4" />
          <span>Filters:</span>
        </div>

        <input
          type="text"
          placeholder="Department..."
          value={filters.department}
          onChange={(e) => setFilters({ ...filters, department: e.target.value })}
          className="px-3 py-1.5 text-xs rounded-xl border bg-slate-900/60 focus:outline-none focus:border-blue-500 w-32"
          style={{ borderColor: "var(--border)" }}
        />

        <input
          type="text"
          placeholder="Year..."
          value={filters.year}
          onChange={(e) => setFilters({ ...filters, year: e.target.value })}
          className="px-3 py-1.5 text-xs rounded-xl border bg-slate-900/60 focus:outline-none focus:border-blue-500 w-24"
          style={{ borderColor: "var(--border)" }}
        />

        <input
          type="text"
          placeholder="Section..."
          value={filters.section}
          onChange={(e) => setFilters({ ...filters, section: e.target.value })}
          className="px-3 py-1.5 text-xs rounded-xl border bg-slate-900/60 focus:outline-none focus:border-blue-500 w-24"
          style={{ borderColor: "var(--border)" }}
        />

        {(filters.department || filters.year || filters.section) && (
          <button
            onClick={() => setFilters({ department: "", year: "", section: "", assessmentType: "all", startDate: "", endDate: "" })}
            className="text-xs text-rose-400 hover:underline cursor-pointer ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Overview Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border flex items-center gap-3.5" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Students</p>
            <p className="text-xl font-extrabold">{overview?.totalStudents ?? 0}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border flex items-center gap-3.5" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Students</p>
            <p className="text-xl font-extrabold">{overview?.activeStudents ?? 0}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border flex items-center gap-3.5" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Completed Assessments</p>
            <p className="text-xl font-extrabold">{overview?.completedAssessments ?? 0}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border flex items-center gap-3.5" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Average Score</p>
            <p className="text-xl font-extrabold">{overview?.averageScore ?? 0}%</p>
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
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === t.id
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dept Performance Chart */}
            <div className="p-6 rounded-2xl border space-y-4" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
              <h3 className="text-sm font-bold tracking-tight text-slate-200">Department Performance Overview</h3>
              {departmentData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="department" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px" }} />
                      <Bar dataKey="averageScore" name="Avg Score %" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-xs text-slate-500">No data available</div>
              )}
            </div>

            {/* Time-based Attempt Trends */}
            <div className="p-6 rounded-2xl border space-y-4" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
              <h3 className="text-sm font-bold tracking-tight text-slate-200">Assessment Activity Over Time</h3>
              {timeData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px" }} />
                      <Line type="monotone" dataKey="total" name="Total Attempts" stroke="#3b82f6" strokeWidth={2} />
                      <Line type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-xs text-slate-500">No data available</div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DEPARTMENT ANALYTICS */}
        {activeTab === "departments" && (
          <div className="p-6 rounded-2xl border space-y-4" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
            <h3 className="text-sm font-bold tracking-tight text-slate-200">Department-Wise Student Analytics</h3>
            {departmentData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/60 uppercase text-[10px] text-slate-400 font-semibold border-b border-slate-800">
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
                  <tbody className="divide-y divide-slate-800/60">
                    {departmentData.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-white">{d.department}</td>
                        <td className="p-3">{d.totalStudents}</td>
                        <td className="p-3">{d.studentsAttempted}</td>
                        <td className="p-3">{d.studentsCompleted}</td>
                        <td className="p-3 font-bold text-blue-400">{d.averageScore}%</td>
                        <td className="p-3 text-emerald-400 font-semibold">{d.highestScore}%</td>
                        <td className="p-3 text-rose-400 font-semibold">{d.lowestScore}%</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {d.passRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-slate-500">No data available</div>
            )}
          </div>
        )}

        {/* TAB 3: STUDENT PERFORMANCE */}
        {activeTab === "students" && (
          <div className="p-6 rounded-2xl border space-y-4" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <h3 className="text-sm font-bold tracking-tight text-slate-200">Student Performance Analytics</h3>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search student name or email..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border bg-slate-900/60 focus:outline-none focus:border-blue-500"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
            </div>

            {studentPerf.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/60 uppercase text-[10px] text-slate-400 font-semibold border-b border-slate-800">
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
                  <tbody className="divide-y divide-slate-800/60">
                    {studentPerf.data.map((s, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-white">
                          <div>{s.name}</div>
                          <div className="text-[10px] text-slate-500">{s.email}</div>
                        </td>
                        <td className="p-3 text-slate-300">{s.department}</td>
                        <td className="p-3 text-slate-400">{s.year} - {s.section}</td>
                        <td className="p-3 font-semibold">{s.totalAttempts}</td>
                        <td className="p-3">{s.completedAttempts}</td>
                        <td className="p-3 font-bold text-blue-400">{s.averageScore}%</td>
                        <td className="p-3 text-emerald-400 font-semibold">{s.bestScore}%</td>
                        <td className="p-3 text-slate-400">
                          {s.latestAssessment ? `${s.latestAssessment.title}` : "None"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-slate-500">No data available</div>
            )}
          </div>
        )}

        {/* TAB 4: REAL INTERVIEW ANALYTICS (READ-ONLY) */}
        {activeTab === "real_interview" && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              IMPORTANT: Real Interview Analytics is strictly READ-ONLY. The Real Interview engine is untouched.
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
                <p className="text-[11px] text-slate-400 font-semibold uppercase">Total Real Sessions</p>
                <p className="text-xl font-extrabold mt-1">{realInterviewData?.totalSessions ?? 0}</p>
              </div>

              <div className="p-4 rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
                <p className="text-[11px] text-slate-400 font-semibold uppercase">Completed Interviews</p>
                <p className="text-xl font-extrabold mt-1 text-emerald-400">{realInterviewData?.completedInterviews ?? 0}</p>
              </div>

              <div className="p-4 rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
                <p className="text-[11px] text-slate-400 font-semibold uppercase">Completion Rate</p>
                <p className="text-xl font-extrabold mt-1 text-blue-400">{realInterviewData?.completionRate ?? 0}%</p>
              </div>

              <div className="p-4 rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
                <p className="text-[11px] text-slate-400 font-semibold uppercase">Average Score</p>
                <p className="text-xl font-extrabold mt-1 text-purple-400">{realInterviewData?.averageInterviewScore ?? 0}%</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: COMPANY MOCKS & COMPARISON */}
        {activeTab === "company_mocks" && (
          <div className="p-6 rounded-2xl border space-y-4" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
            <h3 className="text-sm font-bold tracking-tight text-slate-200">Company Mock Performance & Comparison Matrix</h3>
            {companyMockData.companies?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/60 uppercase text-[10px] text-slate-400 font-semibold border-b border-slate-800">
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
                  <tbody className="divide-y divide-slate-800/60">
                    {companyMockData.companies.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-white flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-400" />
                          <span>{c.companyName}</span>
                        </td>
                        <td className="p-3 font-semibold">{c.studentsCount}</td>
                        <td className="p-3">{c.totalAttempts}</td>
                        <td className="p-3">{c.completedAttempts}</td>
                        <td className="p-3 font-bold text-blue-400">{c.averagePercentage}%</td>
                        <td className="p-3 text-emerald-400 font-semibold">{c.highestPercentage}%</td>
                        <td className="p-3 text-rose-400 font-semibold">{c.lowestPercentage}%</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {c.completionRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-xs text-slate-500">No data available</div>
            )}
          </div>
        )}

        {/* TAB 6: SECTION & SCORE DISTRIBUTION */}
        {activeTab === "distribution" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border space-y-4" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
              <h3 className="text-sm font-bold tracking-tight text-slate-200">Mock Section Performance</h3>
              {sectionData.length > 0 ? (
                <div className="space-y-4">
                  {sectionData.map((sec, i) => (
                    <div key={i} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-200">{sec.name} Section</p>
                        <p className="text-[11px] text-slate-400">Total Attempts: {sec.attempts}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-extrabold text-blue-400">{sec.averageScore}%</p>
                        <p className="text-[10px] text-slate-500">Avg Score</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-slate-500">No data available</div>
              )}
            </div>

            <div className="p-6 rounded-2xl border space-y-4" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
              <h3 className="text-sm font-bold tracking-tight text-slate-200">Overall Score Distribution</h3>
              {distributionData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="range" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "12px" }} />
                      <Bar dataKey="count" name="Student Count" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-slate-500">No data available</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
