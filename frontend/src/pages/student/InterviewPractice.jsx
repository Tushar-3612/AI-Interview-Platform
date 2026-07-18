import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Code2, MessageSquare, Cpu } from "lucide-react";
import { COMPANIES, DIFFICULTIES, CATEGORIES } from "../../data/companies";

/**
 * Interview Practice — company-wise question practice hub.
 */
function InterviewPractice() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");

  const filtered = useMemo(() => {
    return COMPANIES.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (companyFilter && c.id !== companyFilter) return false;
      if (difficultyFilter && c.difficulty !== difficultyFilter) return false;
      return true;
    });
  }, [search, companyFilter, difficultyFilter]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Interview Practice
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Practice company-specific questions to prepare for placements.
        </p>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
              style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
            />
          </div>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border text-sm outline-none cursor-pointer"
            style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
          >
            <option value="">All Companies</option>
            {COMPANIES.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border text-sm outline-none cursor-pointer"
            style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border text-sm outline-none cursor-pointer"
            style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text-primary)" }}
          >
            <option value="">All Difficulties</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Company Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((company, i) => (
            <motion.button
              key={company.id}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ y: -3 }}
              onClick={() => navigate(`/interview-practice/${company.id}`)}
              className="student-card p-5 text-left cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: company.color }}
                >
                  {company.name[0]}
                </div>
                <div>
                  <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                    {company.name}
                  </h3>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      color: company.difficulty === "Hard" ? "var(--error)" : company.difficulty === "Medium" ? "var(--primary)" : "var(--success)",
                      background: "color-mix(in srgb, var(--primary) 8%, transparent)",
                    }}
                  >
                    {company.difficulty}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" /> Technical</span>
                  <span className="font-semibold">{company.technical}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Code2 className="w-3.5 h-3.5" /> Coding</span>
                  <span className="font-semibold">{company.coding}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> HR</span>
                  <span className="font-semibold">{company.hr}</span>
                </div>
                <div className="pt-2 border-t flex justify-between font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <span>Total Questions</span>
                  <span>{company.technical + company.coding + company.hr}</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default InterviewPractice;
