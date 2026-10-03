import { motion } from "framer-motion";
import {
  Globe,
  DollarSign,
  Cpu,
  Code2,
  MessageSquare,
  BookOpen,
  Eye,
  Edit2,
  Trash2,
  Power,
} from "lucide-react";

/**
 * Modern Circular Progress Indicator for Placement / Completion Percentage
 */
function CircularProgress({ percentage = 0, size = 30, strokeWidth = 3 }) {
  const validPercentage = Math.min(100, Math.max(0, Math.round(Number(percentage) || 0)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (validPercentage / 100) * circumference;

  return (
    <div
      className="flex items-center gap-2 select-none"
      title={`Placement / Average Score: ${validPercentage}%`}
      aria-label={`Placement score ${validPercentage}%`}
    >
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-slate-200 dark:text-slate-700/60"
          />
          {/* Indicator */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={validPercentage > 0 ? "#FF6B35" : "currentColor"}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className={validPercentage > 0 ? "transition-all duration-700 ease-out" : "text-transparent"}
          />
        </svg>
      </div>
      <span className="text-xs font-bold text-[#FF6B35] dark:text-[#ff8a57] tracking-tight">
        {validPercentage}%
      </span>
    </div>
  );
}

/**
 * Exam round configuration for modern pill badges
 */
const ROUND_BADGES = {
  aptitude: {
    label: "Aptitude",
    icon: BookOpen,
    lightCls: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
    darkCls: "dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25",
  },
  coding: {
    label: "Coding",
    icon: Code2,
    lightCls: "bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]",
    darkCls: "dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/25",
  },
  technical: {
    label: "Technical",
    icon: Cpu,
    lightCls: "bg-[#F3E8FF] text-[#7E22CE] border-[#E9D5FF]",
    darkCls: "dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/25",
  },
  hr: {
    label: "HR",
    icon: MessageSquare,
    lightCls: "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]",
    darkCls: "dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25",
  },
};

/**
 * Modern Company Card matching SaaS Dashboard reference design
 */
export default function CompanyCard({
  company,
  analytic = {},
  onView,
  onToggleStatus,
  onEdit,
  onDelete,
  index = 0,
}) {
  const supportedRounds =
    company.supportedRounds && company.supportedRounds.length > 0
      ? company.supportedRounds
      : ["aptitude", "coding", "technical", "hr"];

  const rawDate = company.updatedAt || company.lastUpdated || company.createdAt;
  const formattedDate = rawDate
    ? new Date(rawDate).toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      })
    : "9/22/2026";

  const placementScore =
    analytic.averageScore ??
    analytic.placementPercentage ??
    company.passingPercentage ??
    0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="group rounded-[22px] border p-5 sm:p-6 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md"
      style={{
        background: "var(--card-bg, #FFFFFF)",
        borderColor: "var(--border, #E2E8F0)",
      }}
    >
      <div>
        {/* ================= HEADER SECTION ================= */}
        <div className="flex items-start justify-between gap-3">
          {/* Company Branding & Title */}
          <div className="flex items-center gap-3.5 min-w-0">
            {company.logo ? (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center p-1.5 shrink-0 border border-[var(--border)] overflow-hidden shadow-xs"
                style={{ background: "var(--input-bg, #F8FAFC)" }}
              >
                <img
                  src={company.logo}
                  alt={company.name}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shrink-0 shadow-xs select-none"
                style={{ background: company.color || "#2563EB" }}
              >
                {company.name?.[0]?.toUpperCase() || "C"}
              </div>
            )}

            <div className="min-w-0 flex flex-col">
              <h3
                className="text-base font-bold tracking-tight truncate leading-snug"
                style={{ color: "var(--text-primary)" }}
                title={company.name}
              >
                {company.name}
              </h3>

              <div className="mt-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide capitalize select-none transition-colors ${
                    company.status === "active"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-slate-900 text-slate-100 dark:bg-slate-800 dark:text-slate-300 border border-slate-800"
                  }`}
                >
                  {company.status || "inactive"}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-0.5 shrink-0 -mt-1 -mr-1">
            {/* 1. View Button */}
            <button
              type="button"
              onClick={() => onView(company)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 dark:hover:bg-amber-500/20 transition-all cursor-pointer"
              title="View Details"
              aria-label={`View ${company.name} details`}
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* 2. Activate / Deactivate */}
            <button
              type="button"
              onClick={() => onToggleStatus(company)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                company.status === "active"
                  ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20"
                  : "text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20"
              }`}
              title={company.status === "active" ? "Deactivate Company" : "Activate Company"}
              aria-label={company.status === "active" ? "Deactivate company" : "Activate company"}
            >
              <Power className="w-4 h-4" />
            </button>

            {/* 3. Edit Button */}
            <button
              type="button"
              onClick={() => onEdit(company)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-all cursor-pointer"
              title="Edit Company"
              aria-label={`Edit ${company.name}`}
            >
              <Edit2 className="w-4 h-4" />
            </button>

            {/* 4. Delete Button */}
            <button
              type="button"
              onClick={() => onDelete(company)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 transition-all cursor-pointer"
              title="Delete Company"
              aria-label={`Delete ${company.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= OPTIONAL DESCRIPTION ================= */}
        {company.description ? (
          <p
            className="text-xs mt-3 line-clamp-1 leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
            title={company.description}
          >
            {company.description}
          </p>
        ) : null}

        {/* ================= METADATA (PACKAGE & UPDATED DATE) ================= */}
        <div
          className={`flex items-center gap-3 text-xs flex-wrap ${
            company.description ? "mt-2" : "mt-3"
          }`}
          style={{ color: "var(--text-muted)" }}
        >
          {company.package && (
            <span className="font-bold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-3.5 h-3.5 -mr-0.5" />
              {company.package}
            </span>
          )}

          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 opacity-70" />
            Updated {formattedDate}
          </span>
        </div>

        {/* ================= EXAM CATEGORY BADGES ================= */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {["aptitude", "coding", "technical", "hr"].map((roundId) => {
            if (!supportedRounds.includes(roundId)) return null;
            const config = ROUND_BADGES[roundId];
            if (!config) return null;
            const Icon = config.icon;

            return (
              <span
                key={roundId}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold border transition-colors select-none ${config.lightCls} ${config.darkCls}`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span>{config.label}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ================= STATISTICS & PLACEMENT SECTION ================= */}
      <div
        className="flex items-center justify-between pt-3.5 mt-4 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Left: Questions Count by Round */}
        <div
          className="flex items-center gap-3.5 text-xs font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          {/* Technical / Total Questions */}
          <div className="flex items-center gap-1.5" title="Technical Questions">
            <Cpu className="w-3.5 h-3.5 opacity-60" />
            <span className="tabular-nums">{company.technical ?? 15}</span>
          </div>

          {/* Coding Questions */}
          <div className="flex items-center gap-1.5" title="Coding Questions">
            <Code2 className="w-3.5 h-3.5 opacity-60" />
            <span className="tabular-nums">{company.coding ?? 10}</span>
          </div>

          {/* HR Questions */}
          <div className="flex items-center gap-1.5" title="HR Questions">
            <MessageSquare className="w-3.5 h-3.5 opacity-60" />
            <span className="tabular-nums">{company.hr ?? 5}</span>
          </div>
        </div>

        {/* Right: Circular Placement Progress Indicator */}
        <CircularProgress percentage={placementScore} />
      </div>
    </motion.div>
  );
}
