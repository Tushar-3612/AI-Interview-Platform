import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Code2,
  Brain,
  Mic,
  Building2,
  Download,
  X,
  Loader,
  TrendingUp,
  CheckCircle2,
  Target,
  Users,
  Trophy,
  AlertCircle,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "coding", label: "Coding Practice", icon: Code2 },
  { id: "aptitude", label: "Aptitude Practice", icon: Brain },
  { id: "mock", label: "AI Mock Interviews", icon: Mic },
  { id: "companies", label: "Companies", icon: Building2 },
];

const primary = "var(--primary)";
const navy = "var(--admin-navy)";

const cardStyle = {
  background: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  borderRadius: "16px",
  padding: "20px",
  boxShadow: "var(--shadow-card)",
};

const StatCard = ({ icon: Icon, label, value, sub, color = primary }) => (
  <div style={{ ...cardStyle, display: "flex", gap: "16px", alignItems: "center" }}>
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        display: "grid",
        placeItems: "center",
        background: "var(--admin-accent-bg)",
        color,
        flexShrink: 0,
      }}
    >
      <Icon size={22} />
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.15 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  </div>
);

const SectionTitle = ({ children }) => (
  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "4px 0 14px" }}>
    {children}
  </h3>
);

const BarRow = ({ label, value, total, color = primary, suffix = "" }) => {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          marginBottom: 5,
          color: "var(--text-secondary)",
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
        <span>
          {value}
          {suffix}
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: "var(--admin-surface-hover)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 6,
            transition: "width .4s ease",
          }}
        />
      </div>
    </div>
  );
};

const EmptyState = ({ message }) => (
  <div style={{ ...cardStyle, textAlign: "center", color: "var(--text-muted)", padding: "48px 20px" }}>
    <AlertCircle size={28} style={{ marginBottom: 8, opacity: 0.6 }} />
    <div>{message}</div>
  </div>
);

const exportCSV = (rows, headers, filename) => {
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h] ?? "";
          return String(v).includes(",") || String(v).includes('"')
            ? `"${String(v).replace(/"/g, '""')}"`
            : v;
        })
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

function Reports() {
  const token = getAuthToken();
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailCompany, setDetailCompany] = useState(null);

  const [filters, setFilters] = useState({
    studentId: "",
    department: "",
    year: "",
    section: "",
    company: "",
    from: "",
    to: "",
  });

  const clearFilters = () =>
    setFilters({
      studentId: "",
      department: "",
      year: "",
      section: "",
      company: "",
      from: "",
      to: "",
    });

  const fetchStudents = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/students", {
        params: { limit: 300 },
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(data.students || []);
    } catch {
      /* non-blocking */
    }
  }, [token]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.studentId) params.studentId = filters.studentId;
      if (filters.department) params.department = filters.department;
      if (filters.year) params.year = filters.year;
      if (filters.section) params.section = filters.section;
      if (filters.company) params.company = filters.company;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;

      const { data } = await api.get("/api/reports/analytics/placement", {
        params,
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(data);
    } catch (error) {
      console.error("Analytics fetch error", error);
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [token, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const options = data?.filterOptions || {
    departments: [],
    years: [],
    sections: [],
    companies: [],
  };

  const selectStyle = {
    background: "var(--input-bg)",
    border: "1px solid var(--card-border)",
    color: "var(--text-primary)",
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 13,
    minWidth: 150,
    outline: "none",
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const handleExport = () => {
    if (!data) return;
    if (tab === "coding") {
      exportCSV(
        data.coding.byLanguage.map((l) => ({
          Language: l.language,
          Attempted: l.attempted,
          Solved: l.solved,
          Accuracy: `${l.accuracy}%`,
        })),
        ["Language", "Attempted", "Solved", "Accuracy"],
        "coding_practice_by_language.csv"
      );
    } else if (tab === "aptitude") {
      exportCSV(
        data.aptitude.byTopic.map((t) => ({
          Topic: t.topic,
          Attempted: t.attempted,
          Correct: t.correct,
          Accuracy: `${t.accuracy}%`,
        })),
        ["Topic", "Attempted", "Correct", "Accuracy"],
        "aptitude_practice_by_topic.csv"
      );
    } else if (tab === "mock") {
      exportCSV(
        data.mock.history.map((h) => ({
          Date: h.date ? new Date(h.date).toLocaleDateString() : "",
          Student: h.student,
          Type: h.type,
          Company: h.company,
          "Overall Score": h.overallScore ?? "—",
          Round: h.targetRound,
        })),
        ["Date", "Student", "Type", "Company", "Overall Score", "Round"],
        "mock_interviews.csv"
      );
    } else if (tab === "companies") {
      exportCSV(
        data.companies.map((c) => ({
          Company: c.name,
          "Coding Attempted": c.codingAttempted,
          "Coding Solved": c.codingSolved,
          "Aptitude Attempted": c.aptitudeAttempted,
          "Aptitude Correct": c.aptitudeCorrect,
          "Mock Attempted": c.mockAttempted,
          "Mock Completed": c.mockCompleted,
        })),
        [
          "Company",
          "Coding Attempted",
          "Coding Solved",
          "Aptitude Attempted",
          "Aptitude Correct",
          "Mock Attempted",
          "Mock Completed",
        ],
        "company_activity.csv"
      );
    } else {
      exportCSV(
        [
          { Metric: "Total Students", Value: data.overview.totalStudents },
          { Metric: "Coding Attempted", Value: data.overview.codingAttempted },
          { Metric: "Coding Solved", Value: data.overview.codingSolved },
          { Metric: "Aptitude Attempted", Value: data.overview.aptitudeAttempted },
          { Metric: "Aptitude Correct", Value: data.overview.aptitudeCorrect },
          { Metric: "Mock Attempted", Value: data.overview.mockAttempted },
          { Metric: "Mock Completed", Value: data.overview.mockCompleted },
        ],
        ["Metric", "Value"],
        "placement_overview.csv"
      );
    }
    toast.success("Export started");
  };

  const buildParams = () => {
    const params = {};
    if (filters.studentId) params.studentId = filters.studentId;
    if (filters.department) params.department = filters.department;
    if (filters.year) params.year = filters.year;
    if (filters.section) params.section = filters.section;
    if (filters.company) params.company = filters.company;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    return params;
  };

  const downloadBlob = async (url, filename) => {
    try {
      const { data } = await api.get(url, {
        params: buildParams(),
        responseType: "blob",
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = new Blob([data]);
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(u);
      toast.success("Download started");
    } catch (e) {
      console.error("Download error", e);
      toast.error("Download failed");
    }
  };

  const handleDownloadPDF = () =>
    downloadBlob("/api/reports/analytics/placement/pdf", "placement_report.pdf");
  const handleDownloadExcel = () =>
    downloadBlob("/api/reports/analytics/placement/excel", "student_performance.xlsx");

  const selectStudent = (id) => {
    if (id) setFilters((f) => ({ ...f, studentId: id }));
  };

  const areaLabel = (s) => {
    const parts = [];
    if (!s) return "All Students";
    const stu = students.find((x) => String(x._id) === String(s));
    if (stu) return stu.name;
    return "Selected Student";
  };

  return (
    <div style={{ padding: "8px 0 40px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
            Placement Performance &amp; Activity Reports
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 6, fontSize: 14, marginBottom: 0 }}>
            Coding practice, aptitude practice, AI mock interviews and company-wise activity.
            Filters apply across every tab.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={handleDownloadPDF}
            disabled={!data || loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "10px 16px",
              fontWeight: 600,
              fontSize: 13,
              cursor: !data || loading ? "not-allowed" : "pointer",
              opacity: !data || loading ? 0.5 : 1,
            }}
          >
            <Download size={16} /> Download PDF
          </button>
          <button
            onClick={handleDownloadExcel}
            disabled={!data || loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "var(--admin-navy)",
              color: "#06283b",
              border: "none",
              borderRadius: 10,
              padding: "10px 16px",
              fontWeight: 600,
              fontSize: 13,
              cursor: !data || loading ? "not-allowed" : "pointer",
              opacity: !data || loading ? 0.5 : 1,
            }}
          >
            <Download size={16} /> Export Excel
          </button>
          <button
            onClick={handleExport}
            disabled={!data || loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--card-border)",
              borderRadius: 10,
              padding: "10px 16px",
              fontWeight: 600,
              fontSize: 13,
              cursor: !data || loading ? "not-allowed" : "pointer",
              opacity: !data || loading ? 0.5 : 1,
            }}
          >
            <Download size={16} /> Export {tab === "overview" ? "Overview" : TABS.find((t) => t.id === tab)?.label} CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ ...cardStyle, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Student</span>
            <select
              value={filters.studentId}
              onChange={(e) => setFilters((f) => ({ ...f, studentId: e.target.value }))}
              style={selectStyle}
            >
              <option value="">All Students</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} {s.department ? `· ${s.department}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Department</span>
            <select
              value={filters.department}
              onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
              style={selectStyle}
            >
              <option value="">All Departments</option>
              {options.departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Academic Year</span>
            <select
              value={filters.year}
              onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
              style={selectStyle}
            >
              <option value="">All Years</option>
              {options.years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Section</span>
            <select
              value={filters.section}
              onChange={(e) => setFilters((f) => ({ ...f, section: e.target.value }))}
              style={selectStyle}
            >
              <option value="">All Sections</option>
              {options.sections.length === 0 ? (
                <option value="" disabled>No sections recorded</option>
              ) : (
                options.sections.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))
              )}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Company</span>
            <select
              value={filters.company}
              onChange={(e) => setFilters((f) => ({ ...f, company: e.target.value }))}
              style={selectStyle}
            >
              <option value="">All Companies</option>
              {options.companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>From</span>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              style={selectStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>To</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              style={selectStyle}
            />
          </div>

          <button
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--card-border)",
              borderRadius: 10,
              padding: "9px 14px",
              fontWeight: 600,
              fontSize: 13,
              cursor: hasActiveFilters ? "pointer" : "not-allowed",
              opacity: hasActiveFilters ? 1 : 0.5,
            }}
          >
            <X size={14} /> Clear Filters
          </button>
        </div>
        {hasActiveFilters && (
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
            Scope: {areaLabel(filters.studentId)}
            {filters.department ? ` · ${filters.department}` : ""}
            {filters.year ? ` · ${filters.year}` : ""}
            {filters.section ? ` · ${filters.section}` : ""}
            {filters.company ? ` · ${options.companies.find((c) => c.id === filters.company)?.name || filters.company}` : ""}
            {filters.from || filters.to ? ` · ${filters.from || "…"} → ${filters.to || "…"}` : ""}
          </div>
        )}
      </div>

      {filters.studentId &&
        (() => {
          const s = students.find((x) => String(x._id) === String(filters.studentId));
          if (!s) return null;
          return (
            <div
              style={{
                ...cardStyle,
                marginBottom: 18,
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  background: "var(--admin-accent-bg)",
                  color: "var(--primary)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                {(s.name || "S").charAt(0).toUpperCase()}
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Student</div>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{s.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Department</div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{s.department || "N/A"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Academic Year</div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{s.year || "N/A"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Section</div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{s.section || "N/A"}</div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          borderBottom: "1px solid var(--card-border)",
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {TABS.map((t) => {
          const Active = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid var(--primary)" : "2px solid transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                padding: "10px 14px",
                fontWeight: active ? 700 : 600,
                fontSize: 14,
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              <Active size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "50px" }}>
          <Loader size={26} className="spin" style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
          <div style={{ marginTop: 10, color: "var(--text-muted)" }}>Loading reports…</div>
        </div>
      ) : !data ? (
        <EmptyState message="No report data available." />
      ) : (
        <div>
          {tab === "overview" && <OverviewTab data={data} onSelectStudent={selectStudent} />}
          {tab === "coding" && <CodingTab data={data} />}
          {tab === "aptitude" && <AptitudeTab data={data} />}
          {tab === "mock" && <MockTab data={data} />}
          {tab === "companies" && <CompaniesTab data={data} onSelect={setDetailCompany} />}
        </div>
      )}

      {detailCompany && (
        <CompanyModal company={detailCompany} onClose={() => setDetailCompany(null)} />
      )}
    </div>
  );
}

const OverviewTab = ({ data, onSelectStudent }) => {
  const { overview, recentActivity } = data;
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        <StatCard icon={Users} label="Total Students" value={overview.totalStudents} sub="In current scope" />
        <StatCard icon={Code2} label="Coding Attempts" value={overview.codingAttempted} sub={`${overview.codingSolved} solved`} color={primary} />
        <StatCard icon={Brain} label="Aptitude Questions" value={overview.aptitudeAttempted} sub={`${overview.aptitudeCorrect} correct`} color={navy} />
        <StatCard icon={Mic} label="Mock Interviews" value={overview.mockAttempted} sub={`${overview.mockCompleted} completed`} color="var(--badge-purple-text)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={cardStyle}>
          <SectionTitle>Top Companies by Activity</SectionTitle>
          {data.companies.length === 0 ? (
            <EmptyState message="No company activity in this scope." />
          ) : (
            data.companies.slice(0, 8).map((c) => {
              const total = c.codingAttempted + c.aptitudeAttempted + c.mockAttempted;
              return (
                <BarRow
                  key={c.id}
                  label={c.name}
                  value={total}
                  total={data.companies[0]?.activity || 1}
                  color={primary}
                />
              );
            })
          )}
        </div>

        <div style={cardStyle}>
          <SectionTitle>Recent Activity</SectionTitle>
          {recentActivity.length === 0 ? (
            <EmptyState message="No recent activity in this scope." />
          ) : (
            recentActivity.map((a, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: i === recentActivity.length - 1 ? "none" : "1px solid var(--admin-divider)",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: "var(--admin-accent-bg)",
                    color: "var(--primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.type}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    onClick={() => onSelectStudent && onSelectStudent(a.userId)}
                    style={{
                      fontSize: 13,
                      color: "var(--text-primary)",
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      cursor: a.userId ? "pointer" : "default",
                    }}
                  >
                    {a.student}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.detail}</div>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  {a.date ? new Date(a.date).toLocaleDateString() : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const CodingTab = ({ data }) => {
  const { coding } = data;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
        <StatCard icon={Code2} label="Attempts" value={coding.attempted} color={primary} />
        <StatCard icon={CheckCircle2} label="Solved" value={coding.solved} color="var(--success)" />
        <StatCard icon={Target} label="Accuracy" value={`${coding.accuracy}%`} color={navy} />
        <StatCard icon={TrendingUp} label="Failed" value={coding.failed} color="var(--error)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={cardStyle}>
          <SectionTitle>By Language</SectionTitle>
          {coding.byLanguage.length === 0 ? (
            <EmptyState message="No coding submissions in this scope." />
          ) : (
            coding.byLanguage.map((l) => (
              <BarRow
                key={l.language}
                label={l.language}
                value={l.solved}
                total={l.attempted}
                suffix={` / ${l.attempted}`}
                color={primary}
              />
            ))
          )}
        </div>

        <div style={cardStyle}>
          <SectionTitle>By Difficulty</SectionTitle>
          {Object.values(coding.byDifficulty).every((v) => v === 0) ? (
            <EmptyState message="Difficulty data not available for these submissions." />
          ) : (
            Object.entries(coding.byDifficulty).map(([d, v]) => (
              <BarRow key={d} label={d} value={v} total={Math.max(1, ...Object.values(coding.byDifficulty))} color={navy} />
            ))
          )}
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 16 }}>
        <SectionTitle>By Topic</SectionTitle>
        {coding.byTopic.length === 0 ? (
          <EmptyState message="Topic data not available for these submissions." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px" }}>
            {coding.byTopic.map((t) => (
              <BarRow
                key={t.topic}
                label={t.topic}
                value={t.solved}
                total={t.attempted}
                suffix={` / ${t.attempted}`}
                color={primary}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AptitudeTab = ({ data }) => {
  const { aptitude } = data;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <StatCard icon={Brain} label="Practice Sessions" value={aptitude.sessions} color={navy} />
        <StatCard icon={Target} label="Questions" value={aptitude.attempted} color={primary} />
        <StatCard icon={CheckCircle2} label="Correct" value={aptitude.correct} color="var(--success)" />
        <StatCard icon={X} label="Wrong" value={aptitude.wrong} color="var(--error)" />
        <StatCard icon={TrendingUp} label="Accuracy" value={`${aptitude.accuracy}%`} color={navy} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={cardStyle}>
          <SectionTitle>By Topic</SectionTitle>
          {aptitude.byTopic.length === 0 ? (
            <EmptyState message="No aptitude practice in this scope." />
          ) : (
            aptitude.byTopic.map((t) => (
              <BarRow
                key={t.topic}
                label={t.topic}
                value={t.correct}
                total={t.attempted}
                suffix={` / ${t.attempted}`}
                color={navy}
              />
            ))
          )}
        </div>

        <div style={cardStyle}>
          <SectionTitle>By Difficulty</SectionTitle>
          {aptitude.byDifficulty.length === 0 ? (
            <EmptyState message="No difficulty breakdown available." />
          ) : (
            aptitude.byDifficulty.map((d) => (
              <BarRow key={d.difficulty} label={d.difficulty} value={d.count} total={Math.max(...aptitude.byDifficulty.map((x) => x.count))} color={primary} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const MockTab = ({ data }) => {
  const { mock } = data;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
        <StatCard icon={Mic} label="Attempted" value={mock.attempted} color="var(--badge-purple-text)" />
        <StatCard icon={CheckCircle2} label="Completed" value={mock.completed} color="var(--success)" />
        <StatCard
          icon={Trophy}
          label="Avg Overall Score"
          value={mock.avgOverall != null ? mock.avgOverall : "N/A"}
          sub="Only recorded scores"
          color={primary}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={cardStyle}>
          <SectionTitle>By Interview Type</SectionTitle>
          {mock.byType.length === 0 ? (
            <EmptyState message="No mock interviews in this scope." />
          ) : (
            mock.byType.map((t) => (
              <BarRow key={t.type} label={t.type} value={t.count} total={Math.max(...mock.byType.map((x) => x.count))} color="var(--badge-purple-text)" />
            ))
          )}
        </div>

        <div style={cardStyle}>
          <SectionTitle>Completed Interview History</SectionTitle>
          {mock.history.length === 0 ? (
            <EmptyState message="No completed interviews in this scope." />
          ) : (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {mock.history.map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "9px 0",
                    borderBottom: i === mock.history.length - 1 ? "none" : "1px solid var(--admin-divider)",
                    fontSize: 13,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{h.student}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      {h.type} · {h.company} · {h.targetRound}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                      {h.overallScore != null ? h.overallScore : "—"}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      {h.date ? new Date(h.date).toLocaleDateString() : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CompaniesTab = ({ data, onSelect }) => {
  const { companies } = data;
  return (
    <div style={cardStyle}>
      <SectionTitle>Company-wise Activity</SectionTitle>
      {companies.length === 0 ? (
        <EmptyState message="No company activity in this scope." />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-secondary)", textAlign: "left" }}>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Coding (Solved)</th>
                <th style={thStyle}>Aptitude (Correct)</th>
                <th style={thStyle}>Mock (Completed)</th>
                <th style={thStyle}>Activity</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid var(--admin-divider)" }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "var(--text-primary)" }}>{c.name}</td>
                  <td style={tdStyle}>{c.codingAttempted} ({c.codingSolved})</td>
                  <td style={tdStyle}>{c.aptitudeAttempted} ({c.aptitudeCorrect})</td>
                  <td style={tdStyle}>{c.mockAttempted} ({c.mockCompleted})</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: "var(--primary)",
                      }}
                    >
                      {c.activity}
                    </span>
                  </td>
                  <td style={tdStyle} align="right">
                    <button
                      onClick={() => onSelect(c)}
                      style={{
                        background: "var(--admin-accent-bg)",
                        color: "var(--primary)",
                        border: "none",
                        borderRadius: 8,
                        padding: "6px 12px",
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const thStyle = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "12px",
  color: "var(--text-secondary)",
  whiteSpace: "nowrap",
};

const CompanyModal = ({ company, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: "fixed",
      inset: 0,
      background: "var(--admin-modal-overlay)",
      display: "grid",
      placeItems: "center",
      zIndex: 1000,
      padding: 16,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        ...cardStyle,
        width: "100%",
        maxWidth: 520,
        maxHeight: "85vh",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: "var(--text-primary)" }}>{company.name}</h2>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <StatCard icon={Code2} label="Coding Attempts" value={company.codingAttempted} sub={`${company.codingSolved} solved`} color={primary} />
        <StatCard icon={Brain} label="Aptitude Questions" value={company.aptitudeAttempted} sub={`${company.aptitudeCorrect} correct`} color={navy} />
        <StatCard icon={Mic} label="Mock Attempts" value={company.mockAttempted} sub={`${company.mockCompleted} completed`} color="var(--badge-purple-text)" />
        <StatCard icon={TrendingUp} label="Total Activity" value={company.activity} color={primary} />
      </div>

      <div style={{ ...cardStyle, marginTop: 16, boxShadow: "none", background: "var(--admin-surface-hover)" }}>
        <SectionTitle>Breakdown</SectionTitle>
        <BarRow label="Coding" value={company.codingAttempted} total={company.activity || 1} color={primary} />
        <BarRow label="Aptitude" value={company.aptitudeAttempted} total={company.activity || 1} color={navy} />
        <BarRow label="Mock" value={company.mockAttempted} total={company.activity || 1} color="var(--badge-purple-text)" />
      </div>
    </div>
  </div>
);

export default Reports;



