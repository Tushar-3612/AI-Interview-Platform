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
  AlertTriangle,
} from "lucide-react";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import toast from "react-hot-toast";
import QuestionUploader from "./QuestionUploader.jsx";
import CodingUpload from "./CodingUploader.jsx";

const SAMPLE_QUESTIONS_BY_TYPE = {
  mcq: [
    {
      question: "What is the time complexity of binary search in a sorted array?",
      options: ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
      correctAnswer: "O(log n)",
      difficulty: "Easy",
      topic: "Algorithms",
      marks: 1,
      explanation: "Binary search divides the search interval in half with each iteration.",
    },
  ],
  technical: [
    {
      question: "Explain the difference between clustered and non-clustered indexes in SQL.",
      expectedAnswer:
        "A clustered index defines the physical order of data in the table, so only one can exist per table. A non-clustered index stores data in one location and index keys in another, pointing to the data rows.",
      difficulty: "Medium",
      topic: "DBMS & SQL",
      marks: 3,
      explanation:
        "Clustered index alters physical storage order; non-clustered creates a separate structure pointing to the actual data.",
    },
  ],
  coding: [
    {
      title: "Reverse String",
      difficulty: "Easy",
      category: "Strings",
      marks: 10,
      problemStatement: "Given an array of characters, reverse the array in-place.",
      constraints: "1 <= s.length <= 10^5",
      inputFormat: "First line contains integer N.\nSecond line contains space-separated characters.",
      outputFormat: "Print reversed characters separated by space.",
      sampleInput: "5\nh e l l o",
      sampleOutput: "o l l e h",
      starterCode: "function reverseString(s) {\n  // In-place reversal\n}",
      testCases: [
        { input: "5\nh e l l o", expected: "o l l e h", isHidden: false },
        { input: "4\nH a n n", expected: "n n a H", isHidden: true },
      ],
    },
  ],
};

const IMPORT_TABS = [
  { id: "json", label: "JSON", icon: FileCode },
  { id: "csv", label: "CSV", icon: FileSpreadsheet },
  { id: "word", label: "Word (.docx)", icon: FileText },
  { id: "pdf", label: "PDF", icon: FileText },
];

export default function BulkImportModal({
  isOpen,
  onClose,
  onSuccess,
  companyId,
  type = "mcq",
}) {
  const [activeTab, setActiveTab] = useState("json");
  const [jsonText, setJsonText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const [copiedSample, setCopiedSample] = useState(false);

  if (!isOpen) return null;

  const currentType = type?.toLowerCase() || "mcq";
  const typeLabel =
    currentType === "coding"
      ? "Coding Problem"
      : currentType === "technical"
      ? "Technical Question"
      : "Aptitude / MCQ";

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
    const sample = SAMPLE_QUESTIONS_BY_TYPE[currentType] || SAMPLE_QUESTIONS_BY_TYPE.mcq;
    setJsonText(JSON.stringify(sample, null, 2));
    setImportReport(null);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  // Submit questions (array) to the mock questions import endpoint
  const executeImport = async (parsedQuestions) => {
    setImporting(true);
    setImportReport(null);

    try {
      const token = getAuthToken();
      const headers = { Authorization: `Bearer ${token}` };

      const res = await api.post(
        "/api/admin/mock-questions/import",
        {
          companyId,
          type: currentType,
          questions: parsedQuestions,
        },
        { headers }
      );

      const report = res.data?.report || null;
      setImportReport(report);
      toast.success(res.data?.message || "Import completed successfully");
      if (report?.successCount > 0 || !report) {
        onSuccess?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to import questions");
    } finally {
      setImporting(false);
    }
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
    } catch {
      toast.error("Invalid JSON format. Please ensure valid JSON syntax.");
      return;
    }

    if (parsedQuestions.length === 0) {
      toast.error("No valid question objects found in JSON.");
      return;
    }

    await executeImport(parsedQuestions);
  };

  // Handler when questions are parsed from CSV, Word, or PDF document upload
  const handleDocImport = async (validQuestions) => {
    if (!validQuestions || validQuestions.length === 0) {
      toast.error("No valid questions found in uploaded document");
      return;
    }
    await executeImport(validQuestions);
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
                Import Questions —{" "}
                <span className="uppercase" style={{ color: "var(--primary)" }}>
                  {companyId}
                </span>{" "}
                ({typeLabel})
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Import {typeLabel.toLowerCase()}s from different documents (CSV, Word, PDF, or JSON). Duplicates are automatically detected and skipped.
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
          <div
            className="flex items-center gap-2 pt-4 pb-2 border-b"
            style={{ borderColor: "var(--border)" }}
          >
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
            {/* TAB 1: JSON FILE / TEXT INPUT */}
            {activeTab === "json" && (
              <>
                {/* File Upload Box */}
                <div
                  className="border-2 border-dashed rounded-xl p-5 text-center transition-colors hover:border-[#FF6B35]/60 bg-slate-500/5"
                  style={{ borderColor: "var(--border)" }}
                >
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="mock-json-file-input"
                  />
                  <label
                    htmlFor="mock-json-file-input"
                    className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                  >
                    <Upload className="w-7 h-7" style={{ color: "var(--primary)" }} />
                    <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                      Click to upload JSON file
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Supports standard array of question objects for {companyId.toUpperCase()}
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
                    value={jsonText}
                    onChange={(e) => {
                      setJsonText(e.target.value);
                      setImportReport(null);
                    }}
                    placeholder={`[\n  {\n    "question": "Sample question text...",\n    "options": ["A", "B", "C", "D"],\n    "correctAnswer": "A",\n    "difficulty": "Easy"\n  }\n]`}
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
                    className="p-4 rounded-xl border text-xs space-y-3 bg-slate-500/5"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Import Report Summary</span>
                    </h4>
                    <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                        <div className="text-base font-extrabold">{importReport.successCount}</div>
                        <div className="text-[10px] uppercase tracking-wider">Imported</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                        <div className="text-base font-extrabold">{importReport.duplicateCount}</div>
                        <div className="text-[10px] uppercase tracking-wider">Duplicates Skipped</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">
                        <div className="text-base font-extrabold">{importReport.rejectedCount}</div>
                        <div className="text-[10px] uppercase tracking-wider">Errors</div>
                      </div>
                    </div>

                    {importReport.duplicates?.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <p className="text-[11px] font-semibold text-amber-500 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Skipped Existing Duplicate Questions:</span>
                        </p>
                        <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                          {importReport.duplicates.map((dup, i) => (
                            <div
                              key={i}
                              className="text-[11px] p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 truncate"
                            >
                              #{dup.index + 1}: {dup.question}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
              <>
                {currentType === "coding" ? (
                  <CodingUpload
                    source={activeTab}
                    onAdd={handleDocImport}
                    onCancel={onClose}
                  />
                ) : (
                  <QuestionUploader
                    source={activeTab}
                    onAdd={handleDocImport}
                    onCancel={onClose}
                  />
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
