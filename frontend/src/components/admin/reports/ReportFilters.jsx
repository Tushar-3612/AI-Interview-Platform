import { Search, X } from "lucide-react";

export default function ReportFilters({
  searchQuery, onSearchChange,
  department, onDepartmentChange,
  year, onYearChange,
  company, onCompanyChange,
  dateFrom, onDateFromChange,
  dateTo, onDateToChange,
  departments, years, companies,
  onApply, onClear,
  showExtra = true,
}) {
  return (
    <div
      className="p-4 rounded-2xl border space-y-3"
      style={{ background: "var(--card-bg)", borderColor: "var(--border)" }}
    >
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            Search Student
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Name or email..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm outline-none transition-all focus:ring-2"
              style={{
                background: "var(--bg-primary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>

        {showExtra && (
          <>
            <div className="min-w-[140px]">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Department
              </label>
              <select
                value={department}
                onChange={e => onDepartmentChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                style={{
                  background: "var(--bg-primary)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">All Departments</option>
                {(departments || []).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="min-w-[120px]">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Year
              </label>
              <select
                value={year}
                onChange={e => onYearChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                style={{
                  background: "var(--bg-primary)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">All Years</option>
                {(years || []).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="min-w-[140px]">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Company
              </label>
              <select
                value={company}
                onChange={e => onCompanyChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                style={{
                  background: "var(--bg-primary)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">All Companies</option>
                {(companies || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="min-w-[130px]">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => onDateFromChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                style={{
                  background: "var(--bg-primary)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div className="min-w-[130px]">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={e => onDateToChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                style={{
                  background: "var(--bg-primary)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </>
        )}

        {(searchQuery || department || year || company || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
