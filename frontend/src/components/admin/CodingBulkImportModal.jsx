import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Upload,
  FileText,
  FileCode,
  FileSpreadsheet,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";
import CodingUpload from "./CodingUploader";

const SAMPLE_CODING_JSON = [
  {
    title: "Two Sum Problem",
    difficulty: "Easy",
    category: "Arrays",
    companyId: "celebal",
    marks: 10,
    problemStatement:
      "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    inputFormat:
      "First line contains integer N.\nSecond line contains N space-separated integers.\nThird line contains integer target.",
    outputFormat: "Print the two 0-based indices separated by space.",
    constraints: "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9",
    sampleInput: "4\n2 7 11 15\n9",
    sampleOutput: "0 1",
    explanation: "Because nums[0] + nums[1] == 2 + 7 == 9, return indices 0 1.",
    starterCode: "function solution(nums, target) {\n  // Write your code here\n}",
    languages: ["JavaScript", "Python", "Java", "C++"],
    testCases: [
      { input: "4\n2 7 11 15\n9", expected: "0 1", isHidden: false },
      { input: "3\n3 2 4\n6", expected: "1 2", isHidden: false },
      { input: "2\n3 3\n6", expected: "0 1", isHidden: true },
    ],
  },
];

const IMPORT_TABS = [
  { id: "json", label: "JSON", icon: FileCode },
  { id: "csv", label: "CSV", icon: FileSpreadsheet },
  { id: "word", label: "Word (.docx)", icon: FileText },
  { id: "pdf", label: "PDF", icon: FileText },
];

export default function CodingBulkImportModal({
  isOpen,
  onClose,
  onSuccess,
  companies = [],
  defaultCompanyId = "",
}) {
  const [activeTab, setActiveTab] = useState("json");
  const [jsonText, setJsonText] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(defaultCompanyId || "");
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const [copiedSample, setCopiedSample] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonText(event.target?.result || "");
      setImportReport(null);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    setJsonText(JSON.stringify(SAMPLE_CODING_JSON, null, 2));
    setImportReport(null);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  const handleJsonImportSubmit = async () => {
    if (!jsonText.trim()) {
      toast.error("Please paste or upload JSON content to import");
      return;
    }

    let parsedQuestions = [];
    try {
      const raw = JSON.parse(jsonText);
      parsedQuestions = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.questions)
        ? raw.questions
        : [raw];
    } catch (err) {
      toast.error("Invalid JSON format. Please check syntax (missing commas/quotes).");
      return;
    }

    if (parsedQuestions.length === 0) {
      toast.error("No valid question objects found in JSON.");
      return;
    }

    const questionsWithCompany = parsedQuestions.map((q) => ({
      ...q,
      companyId: q.companyId || (selectedCompany ? selectedCompany : undefined),
    }));

    setImporting(true);
    setImportReport(null);

    try {
      const token = getAuthToken();
      const headers = { Authorization: `Bearer ${token}` };

      const res = await api.post(
        "/api/coding-questions/bulk-import",
        { questions: questionsWithCompany },
        { headers }
      );

      const report = {
        created: res.data?.created || 0,
        updated: res.data?.updated || 0,
        skipped: res.data?.skipped || 0,
        message: res.data?.message || "Import completed successfully",
      };

      setImportReport(report);
      toast.success(res.data?.message || "Import completed successfully!");
      if (report.created > 0 || report.updated > 0) {
        onSuccess();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to import coding questions");
    } finally {
      setImporting(false);
    }
  };

  const handleDocImport = async (validQuestions) => {
    if (!validQuestions || validQuestions.length === 0) return;
    setImporting(true);
    try {
      const token = getAuthToken();
      const headers = { Authorization: `Bearer ${token}` };

      const questionsWithCompany = validQuestions.map((q) => ({
        ...q,
        companyId: q.companyId || (selectedCompany ? selectedCompany : undefined),
      }));

      const res = await api.post(
        "/api/coding-questions/bulk-import",
        { questions: questionsWithCompany },
        { headers }
      );

      toast.success(res.data?.message || `Successfully imported ${validQuestions.length} coding questions!`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save questions to database");
    } finally {
      setImporting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 backdrop-blur-md"
          style={{ background: "var(--admin-modal-overlay, rgba(0, 0, 0, 0.7))" }}
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-2xl rounded-2xl border p-6 shadow-2xl z-10 my-8"
          style={{
            background: "var(--card-bg, #FFFFFF)",
            borderColor: "var(--border, #ECECEC)",
            color: "var(--text-primary, #111827)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between pb-4 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <div>
              <h3 className="text-base font-bold tracking-tight">
                Import Coding Questions from Documents
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Import coding problems and test cases via JSON, CSV, Word, or PDF templates.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl transition-colors hover:bg-slate-500/10 cursor-pointer"
              style={{ color: "var(--text-muted)" }}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Document Format Tabs */}
          <div className="flex items-center gap-2 pt-4 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
            {IMPORT_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setImportReport(null);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    isActive
                      ? "shadow-xs"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                  style={{
                    background: isActive ? "rgba(255, 107, 53, 0.1)" : "transparent",
                    borderColor: isActive ? "rgba(255, 107, 53, 0.3)" : "transparent",
                    color: isActive ? "var(--primary)" : "var(--text-secondary)",
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="py-4 space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {/* Optional Company Assignment */}
            {companies.length > 0 && (
              <div
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border bg-slate-500/5"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    Target Company (Optional)
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    Applies if individual questions in the document do not specify a company.
                  </p>
                </div>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border bg-[var(--card-bg)] outline-none focus:ring-1 focus:ring-[#FF6B35] cursor-pointer"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="">Default / In Document</option>
                  {companies.map((c) => (
                    <option key={c.id || c._id} value={c.id || c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* TAB 1: JSON IMPORT */}
            {activeTab === "json" && (
              <>
                {/* File Upload Box */}
                <div
                  className="border-2 border-dashed rounded-xl p-5 text-center transition-colors cursor-pointer hover:border-[#FF6B35]/60 bg-slate-500/5"
                  style={{ borderColor: "var(--border)" }}
                >
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="coding-json-file-input"
                  />
                  <label
                    htmlFor="coding-json-file-input"
                    className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                  >
                    <Upload className="w-7 h-7" style={{ color: "var(--primary)" }} />
                    <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                      Click to upload JSON file
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Supports array of coding problem objects with test cases
                    </span>
                  </label>
                </div>

                {/* JSON Textarea with Sample Helper */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      className="block text-xs font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Or Paste JSON Content Below
                    </label>
                    <button
                      type="button"
                      onClick={handleLoadSample}
                      className="flex items-center gap-1 text-[11px] font-bold transition-opacity hover:opacity-80 cursor-pointer"
                      style={{ color: "var(--primary)" }}
                    >
                      {copiedSample ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSample ? "Sample Loaded!" : "Load Sample JSON"}</span>
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    placeholder='[\n  {\n    "title": "Two Sum",\n    "difficulty": "Easy",\n    "category": "Arrays",\n    "problemStatement": "...",\n    "testCases": [...]\n  }\n]'
                    value={jsonText}
                    onChange={(e) => {
                      setJsonText(e.target.value);
                      setImportReport(null);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border font-mono outline-none focus:border-[#FF6B35] focus:ring-1 focus:ring-[#FF6B35]/20 leading-relaxed"
                    style={{
                      background: "var(--input-bg)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                {/* Import Status / Report Feedback */}
                {importReport && (
                  <div
                    className="p-4 rounded-xl border text-xs space-y-2 bg-slate-500/5"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{importReport.message}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 font-semibold text-center">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <div className="text-base font-extrabold">{importReport.created}</div>
                        <div className="text-[10px] uppercase tracking-wider">Created</div>
                      </div>
                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <div className="text-base font-extrabold">{importReport.updated}</div>
                        <div className="text-[10px] uppercase tracking-wider">Updated</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-500/10 text-slate-500 dark:text-slate-400">
                        <div className="text-base font-extrabold">{importReport.skipped}</div>
                        <div className="text-[10px] uppercase tracking-wider">Skipped</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Actions for JSON */}
                <div
                  className="flex items-center justify-end gap-3 pt-3 border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border hover:bg-slate-500/10 transition-colors cursor-pointer"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleJsonImportSubmit}
                    disabled={importing || !jsonText.trim()}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 hover:opacity-90 shadow-sm"
                    style={{ background: "var(--primary)" }}
                  >
                    {importing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Importing...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Start Import</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* TAB 2, 3, 4: CSV, WORD, PDF DOCUMENT UPLOAD */}
            {activeTab !== "json" && (
              <CodingUpload
                source={activeTab}
                onAdd={handleDocImport}
                onCancel={onClose}
              />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
