import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Download, Users, Building2, BarChart3,
  GraduationCap, Search, Loader2, FileSpreadsheet,
  Mail, Printer, RefreshCw, Eye, Award,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import ReportCard from "../../components/admin/reports/ReportCard";
import ReportFilters from "../../components/admin/reports/ReportFilters";
import StudentReportView from "../../components/admin/reports/StudentReportView";
import SectionWiseReport from "../../components/admin/reports/SectionWiseReport";

const TABS = [
  { id: "student", label: "Student Reports", icon: Users },
  { id: "batch", label: "Batch Reports", icon: GraduationCap },
  { id: "company", label: "Company Reports", icon: Building2 },
  { id: "practice", label: "Practice Reports", icon: BarChart3 },
];

export default function ReportsModule() {
  const headers = { Authorization: `Bearer ${getAuthToken()}` };
  const [activeTab, setActiveTab] = useState("student");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [company, setCompany] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Select options
  const [departments, setDepartments] = useState([]);
  const [years, setYears] = useState([]);
  const [companies, setCompanies] = useState([]);

  // Student report detail
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentReport, setStudentReport] = useState(null);

  // Stats
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchMeta();
    fetchStats();
    fetchHistory();
  }, []);

  const fetchMeta = async () => {
    try {
      const { data: c } = await api.get("/api/reports/companies/list", { headers });
      setCompanies(c || []);
      const { data: s } = await api.get("/api/admin/students", { headers, params: { limit: 1 } });
      if (s?.students) {
        const depts = [...new Set(s.students.map(st => st.department).filter(Boolean))];
        const yrs = [...new Set(s.students.map(st => st.year).filter(Boolean))];
        setDepartments(depts);
        setYears(yrs);
      }
    } catch {}
  };

  const fetchStats = async () => {
    try {
      const { data: s } = await api.get("/api/admin/students", { headers, params: { limit: 1 } });
      const { data: r } = await api.get("/api/reports/history", { headers });
      const totalStudents = s?.pagination?.total || s?.students?.length || 0;
      setStats({ totalStudents, reportsGenerated: r?.length || 0 });
    } catch {}
  };

  const fetchHistory = async () => {
    try {
      const { data } = await api.get("/api/reports/history", { headers });
      setHistory(data || []);
    } catch {}
  };

  const handleSearch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (activeTab === "student") {
        if (!searchQuery.trim()) {
          const params = {};
          if (department) params.department = department;
          if (year) params.year = year;
          if (company) params.company = company;
          if (dateFrom) params.dateFrom = dateFrom;
          if (dateTo) params.dateTo = dateTo;
          const { data: d } = await api.get("/api/reports/search", { headers, params });
          setData(d);
        } else {
          const params = { q: searchQuery };
          if (department) params.department = department;
          if (year) params.year = year;
          const { data: d } = await api.get("/api/reports/search", { headers, params });
          setData(d);
        }
      } else if (activeTab === "batch") {
        const params = {};
        if (department) params.department = department;
        if (year) params.year = year;
        const { data: d } = await api.get("/api/reports/batch", { headers, params });
        setData(d);
      } else if (activeTab === "company") {
        if (!company) { toast.error("Select a company"); setLoading(false); return; }
        const { data: d } = await api.get(`/api/reports/company/${company}`, { headers });
        setData(d);
      } else if (activeTab === "practice") {
        const { data: d } = await api.get("/api/reports/practice", { headers });
        setData(d);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, department, year, company, dateFrom, dateTo]);

  useEffect(() => {
    if (activeTab === "practice") handleSearch();
    if (activeTab === "batch" && (department || year)) handleSearch();
  }, [activeTab]);

  const handleViewStudent = async (studentId) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/reports/student/${studentId}`, { headers });
      setStudentReport(data);
      setSelectedStudent(studentId);
    } catch {
      toast.error("Failed to load student report");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const params = {};
      if (department) params.department = department;
      if (year) params.year = year;

      if (format === "csv") {
        window.open(`/api/reports/export/csv?token=${getAuthToken()}&${new URLSearchParams(params)}`, "_blank");
      } else if (format === "excel") {
        window.open(`/api/reports/export/excel?token=${getAuthToken()}&${new URLSearchParams(params)}`, "_blank");
      } else if (format === "full-excel") {
        window.open(`/api/reports/export/full-excel?token=${getAuthToken()}&${new URLSearchParams(params)}`, "_blank");
      } else if (format === "batch-pdf") {
        window.open(`/api/reports/batch/pdf?token=${getAuthToken()}&${new URLSearchParams(params)}`, "_blank");
      }
      toast.success(`${format.toUpperCase()} exported`);
      fetchHistory();
    } catch {
      toast.error("Export failed");
    }
  };

  const clearFilters = () => {
    setSearchQuery(""); setDepartment(""); setYear("");
    setCompany(""); setDateFrom(""); setDateTo("");
    setData(null); setError(null);
  };

  if (studentReport) {
    return (
      <div className="space-y-6">
        <StudentReportView
          report={studentReport}
          onClose={() => { setStudentReport(null); setSelectedStudent(null); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Reports Dashboard</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            Generate and manage student performance reports
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ReportCard icon={Users} label="Total Students" value={stats.totalStudents} />
          <ReportCard icon={FileText} label="Reports Generated" value={stats.reportsGenerated} />
          <ReportCard icon={Building2} label="Companies" value={companies.length} />
          <ReportCard icon={GraduationCap} label="Departments" value={departments.length} />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "var(--bg-primary)", border: "1px solid var(--border)" }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setData(null); setError(null); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer flex-1 justify-center"
              style={{
                background: isActive ? "var(--card-bg)" : "transparent",
                color: isActive ? "var(--primary)" : "var(--text-secondary)",
                boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <ReportFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        department={department}
        onDepartmentChange={setDepartment}
        year={year}
        onYearChange={setYear}
        company={company}
        onCompanyChange={setCompany}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        departments={departments}
        years={years}
        companies={companies}
        onApply={handleSearch}
        onClear={clearFilters}
        showExtra={activeTab !== "practice"}
      />

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer disabled:opacity-50"
          style={{ background: "var(--primary)", color: "white" }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? "Loading..." : "Generate Report"}
        </button>

        {activeTab === "batch" && data && (
          <>
            <button type="button" onClick={() => handleExport("batch-pdf")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              <FileText className="w-4 h-4" /> Download PDF
            </button>
          </>
        )}

        {(activeTab === "batch" || activeTab === "student") && (
          <>
            <button type="button" onClick={() => handleExport("csv")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              <FileSpreadsheet className="w-4 h-4" /> Export CSV
            </button>
            <button type="button" onClick={() => handleExport("excel")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </button>
            <button type="button" onClick={() => handleExport("full-excel")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              <FileSpreadsheet className="w-4 h-4" /> Full Excel
            </button>
          </>
        )}

        {data && (
          <button type="button" onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <Printer className="w-4 h-4" /> Print
          </button>
        )}
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
          </motion.div>
        )}

        {error && !loading && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-8 text-center rounded-2xl border" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--error, #dc2626)" }}>{error}</p>
          </motion.div>
        )}

        {!loading && !error && data && activeTab === "student" && (
          <motion.div key="student-data" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border overflow-hidden" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="text-left py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Department</th>
                    <th className="text-center py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Year</th>
                    <th className="text-center py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>ATS</th>
                    <th className="text-center py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Tests</th>
                    <th className="text-center py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Best %</th>
                    <th className="text-center py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.students || []).length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-xs" style={{ color: "var(--text-muted)" }}>No students found</td></tr>
                  ) : (data.students || []).map((s, i) => (
                    <tr key={s._id || i} className="border-b" style={{ borderColor: "var(--border)" }}>
                      <td className="py-3 px-4 font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</td>
                      <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>{s.email}</td>
                      <td className="py-3 px-4" style={{ color: "var(--text-secondary)" }}>{s.department}</td>
                      <td className="text-center py-3 px-4" style={{ color: "var(--text-secondary)" }}>{s.year}</td>
                      <td className="text-center py-3 px-4" style={{ color: "var(--text-secondary)" }}>{s.atsScore ?? "-"}</td>
                      <td className="text-center py-3 px-4" style={{ color: "var(--text-secondary)" }}>{s.tests ?? 0}</td>
                      <td className="text-center py-3 px-4">
                        <span className="text-xs font-semibold" style={{ color: (s.bestPercentage || 0) >= 60 ? "var(--success, #16a34a)" : "var(--error, #dc2626)" }}>
                          {s.bestPercentage != null ? `${s.bestPercentage}%` : "-"}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <button type="button" onClick={() => handleViewStudent(s._id)}
                          className="flex items-center gap-1 mx-auto px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
                          style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.pagination && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                <span>Showing {data.students?.length || 0} of {data.pagination.total} students</span>
              </div>
            )}
          </motion.div>
        )}

        {!loading && !error && data && activeTab === "batch" && (
          <motion.div key="batch-data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ReportCard icon={Users} label="Total Students" value={data.totalStudents} color="var(--primary)" />
              <ReportCard icon={Award} label="Average" value={data.stats?.averageMarks ? `${data.stats.averageMarks}%` : "0%"} color="#f59e0b" />
              <ReportCard icon={Award} label="Highest" value={data.stats?.highestMarks ? `${data.stats.highestMarks}%` : "0%"} color="var(--success, #16a34a)" />
              <ReportCard icon={Award} label="Pass %" value={data.stats?.passPercentage ? `${data.stats.passPercentage}%` : "0%"} color="var(--primary)" />
            </div>

            {/* Top Students */}
            {data.topStudents?.length > 0 && (
              <div className="rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
                <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Top Students</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                        <th className="text-left py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Rank</th>
                        <th className="text-left py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Name</th>
                        <th className="text-center py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Department</th>
                        <th className="text-center py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Best %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topStudents.map((s, i) => (
                        <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                          <td className="py-3 px-4">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "text-white" : ""}`}
                              style={{ background: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#d97706" : "var(--border)" }}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</td>
                          <td className="text-center py-3 px-4" style={{ color: "var(--text-secondary)" }}>{s.department}</td>
                          <td className="text-center py-3 px-4 font-semibold" style={{ color: "var(--success, #16a34a)" }}>{s.bestPercentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {!loading && !error && data && activeTab === "company" && (
          <motion.div key="company-data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ReportCard icon={Users} label="Students Appeared" value={data.totalStudentsAppeared} color="var(--primary)" />
              <ReportCard icon={Award} label="Average Score" value={data.stats?.averageScore ? `${data.stats.averageScore}%` : "0%"} color="#f59e0b" />
              <ReportCard icon={Award} label="Highest" value={data.stats?.highestScore ? `${data.stats.highestScore}%` : "0%"} color="var(--success, #16a34a)" />
              <ReportCard icon={Award} label="Lowest" value={data.stats?.lowestScore ? `${data.stats.lowestScore}%` : "0%"} color="var(--error, #dc2626)" />
            </div>
            {data.students?.length > 0 && (
              <div className="rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                        <th className="text-left py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Name</th>
                        <th className="text-center py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Avg %</th>
                        <th className="text-center py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Best</th>
                        <th className="text-center py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.students.map((s, i) => (
                        <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                          <td className="py-3 px-4 font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</td>
                          <td className="text-center py-3 px-4" style={{ color: "var(--text-secondary)" }}>{s.averagePercentage}%</td>
                          <td className="text-center py-3 px-4 font-semibold" style={{ color: "var(--success, #16a34a)" }}>{s.bestScore}%</td>
                          <td className="text-center py-3 px-4">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                              style={{
                                background: s.selectionReady ? "color-mix(in srgb, var(--success, #16a34a) 15%, transparent)" : "color-mix(in srgb, #f59e0b 15%, transparent)",
                                color: s.selectionReady ? "var(--success, #16a34a)" : "#f59e0b",
                              }}>
                              {s.selectionReady ? "Ready" : "Needs Work"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {!loading && !error && data && activeTab === "practice" && (
          <motion.div key="practice-data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ReportCard icon={BarChart3} label="Total Attempts" value={data.totalPracticeAttempts} color="var(--primary)" />
              <ReportCard icon={Building2} label="Most Practiced" value={data.mostPracticedCompany || "N/A"} color="#f59e0b" />
              <ReportCard icon={Award} label="Highest Score" value={data.highestPracticeScore ?? "-"} color="var(--success, #16a34a)" />
              <ReportCard icon={Award} label="Lowest Score" value={data.lowestPracticeScore ?? "-"} color="var(--error, #dc2626)" />
            </div>
            {data.companyWise?.length > 0 && (
              <div className="rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
                <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Company-wise Practice Stats</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                        <th className="text-left py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Company</th>
                        <th className="text-center py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Attempts</th>
                        <th className="text-center py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Average</th>
                        <th className="text-center py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Highest</th>
                        <th className="text-center py-3 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Lowest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.companyWise.map((c, i) => (
                        <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                          <td className="py-3 px-4 font-medium" style={{ color: "var(--text-primary)" }}>{c.company}</td>
                          <td className="text-center py-3 px-4" style={{ color: "var(--text-secondary)" }}>{c.totalAttempts}</td>
                          <td className="text-center py-3 px-4" style={{ color: "var(--text-secondary)" }}>{c.averageScore ?? "-"}</td>
                          <td className="text-center py-3 px-4" style={{ color: "var(--success, #16a34a)" }}>{c.highestScore ?? "-"}</td>
                          <td className="text-center py-3 px-4" style={{ color: "var(--error, #dc2626)" }}>{c.lowestScore ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {!loading && !error && !data && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-12 text-center rounded-2xl border" style={{ borderColor: "var(--border)" }}>
            <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Select filters and click "Generate Report" to view data
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report History */}
      {history.length > 0 && !data && (
        <div className="rounded-2xl border" style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}>
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Report History</h3>
            <button type="button" onClick={fetchHistory}
              className="p-1.5 rounded-lg cursor-pointer" style={{ color: "var(--text-secondary)" }}>
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Type</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Format</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Status</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-xs" style={{ color: "var(--text-secondary)" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 10).map((h, i) => (
                  <tr key={h._id || i} className="border-b" style={{ borderColor: "var(--border)" }}>
                    <td className="py-2.5 px-4 capitalize" style={{ color: "var(--text-primary)" }}>{h.reportType}</td>
                    <td className="py-2.5 px-4 uppercase" style={{ color: "var(--text-secondary)" }}>{h.downloadFormat}</td>
                    <td className="py-2.5 px-4 capitalize" style={{ color: "var(--text-primary)" }}>{h.status}</td>
                    <td className="py-2.5 px-4" style={{ color: "var(--text-secondary)" }}>{new Date(h.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
