import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileText, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

export default function BulkImportModal({ isOpen, onClose, onSuccess, companyId, type = "mcq" }) {
  const [jsonText, setJsonText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState(null);

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

  const handleImportSubmit = async () => {
    if (!jsonText.trim()) {
      toast.error("Please paste or upload JSON content to import");
      return;
    }

    let parsedQuestions = [];
    try {
      const raw = JSON.parse(jsonText);
      parsedQuestions = Array.isArray(raw) ? raw : Array.isArray(raw.questions) ? raw.questions : [raw];
    } catch (err) {
      toast.error("Invalid JSON format. Please ensure valid JSON syntax.");
      return;
    }

    if (parsedQuestions.length === 0) {
      toast.error("No valid question objects found in JSON.");
      return;
    }

    setImporting(true);
    setImportReport(null);

    try {
      const token = getAuthToken();
      const headers = { Authorization: `Bearer ${token}` };

      const res = await api.post(
        "/api/admin/mock-questions/import",
        {
          companyId,
          type,
          questions: parsedQuestions,
        },
        { headers }
      );

      setImportReport(res.data?.report || null);
      toast.success(res.data?.message || "Import completed");
      if (res.data?.report?.successCount > 0) {
        onSuccess();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to import questions");
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
          style={{ background: "var(--card-bg, #1e293b)", borderColor: "var(--border, #334155)", color: "var(--text-primary, #f8fafc)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: "var(--border, #334155)" }}>
            <div>
              <h3 className="text-base font-bold tracking-tight">
                Bulk Import Questions — <span className="uppercase text-blue-400">{companyId}</span> ({type.toUpperCase()})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload or paste JSON data. Duplicates are automatically detected and rejected.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl transition-colors hover:bg-slate-700/50 cursor-pointer"
              style={{ color: "var(--text-muted, #64748b)" }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* File Upload Box */}
            <div className="border-2 border-dashed rounded-xl p-4 text-center border-slate-700 hover:border-blue-500/50 bg-slate-900/30 transition-colors">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                id="json-file-input"
              />
              <label htmlFor="json-file-input" className="cursor-pointer flex flex-col items-center justify-center gap-1.5">
                <Upload className="w-6 h-6 text-blue-400" />
                <span className="text-xs font-semibold text-slate-200">Click to upload JSON file</span>
                <span className="text-[11px] text-slate-500">Supports standard array of question objects</span>
              </label>
            </div>

            {/* JSON Textarea */}
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-300">
                Or Paste JSON Content Below
              </label>
              <textarea
                rows={6}
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setImportReport(null);
                }}
                placeholder={`[\n  {\n    "question": "What is a primary key?",\n    "options": ["Option A", "Option B"],\n    "correctAnswer": "Option A",\n    "difficulty": "Easy",\n    "topic": "DBMS"\n  }\n]`}
                className="w-full px-3 py-2 text-xs rounded-xl border bg-slate-950 font-mono text-slate-200 focus:outline-none focus:border-blue-500 leading-relaxed"
                style={{ borderColor: "var(--border, #334155)" }}
              />
            </div>

            {/* Import Summary Report */}
            {importReport && (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Import Report Summary</span>
                </h4>
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                    {importReport.successCount} Imported
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold">
                    {importReport.duplicateCount} Duplicates Skipped
                  </div>
                  <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold">
                    {importReport.rejectedCount} Errors
                  </div>
                </div>

                {importReport.duplicates?.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-[11px] font-semibold text-amber-300">Skipped Duplicate Questions:</p>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                      {importReport.duplicates.map((dup, i) => (
                        <div key={i} className="text-[11px] p-2 rounded-md bg-amber-950/30 border border-amber-500/20 text-amber-200 truncate">
                          #{dup.index + 1}: {dup.question}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t flex justify-end gap-3" style={{ borderColor: "var(--border, #334155)" }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleImportSubmit}
              disabled={importing || !jsonText.trim()}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {importing ? (
                <span>Validating & Importing...</span>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Start Import</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
