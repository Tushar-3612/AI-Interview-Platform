import { useState, useRef } from "react";
import { Upload, FileText, AlertCircle, CheckCircle, X } from "lucide-react";
import { motion } from "framer-motion";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

const ACCEPTED = ".csv, .xlsx, .xls, .pdf";

export default function FileUploader({ onQuestionsParsed }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/api/tests/upload-questions", formData, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setResult(data);
      if (data.errors?.length) {
        toast.error(`${data.errors.length} validation error(s)`);
      } else {
        toast.success(`${data.total} questions parsed`);
      }
      onQuestionsParsed(data.questions, data.errors);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    handleFile(file);
    e.target.value = "";
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragging ? "border-[var(--primary)]" : "admin-border"
        }`}
        style={{ background: dragging ? "color-mix(in srgb, var(--primary) 5%, transparent)" : "transparent" }}
      >
        <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={handleChange} />
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Parsing questions...</p>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Drop your file here or click to browse
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>CSV, Excel, or PDF (.csv, .xlsx, .xls, .pdf)</p>
          </>
        )}
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-2"
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <FileText className="w-3.5 h-3.5" />
            <span>{result.total} questions parsed</span>
            {result.duplicates > 0 && (
              <span className="text-xs" style={{ color: "var(--badge-warning-text)" }}>
                ({result.duplicates} duplicates removed)
              </span>
            )}
          </div>
          {result.errors?.length > 0 && (
            <div className="p-3 rounded-lg text-xs space-y-1" style={{ background: "var(--badge-error-bg)" }}>
              {result.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" style={{ color: "var(--badge-error-text)" }} />
                  <span style={{ color: "var(--badge-error-text)" }}>{err}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
