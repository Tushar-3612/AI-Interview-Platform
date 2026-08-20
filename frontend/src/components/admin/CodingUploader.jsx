import { useState, useRef, Fragment } from "react";
import { Upload, AlertCircle, CheckCircle, Download, FileCheck, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

const FORMAT_MAP = {
  csv: { ext: "csv", accept: ".csv", mime: "text/csv", label: "CSV" },
  word: { ext: "docx", accept: ".docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word" },
  pdf: { ext: "pdf", accept: ".pdf", mime: "application/pdf", label: "PDF" },
};

const REQUIRED_FORMAT_CSV =
  "problem_id | title | marks | difficulty | description | constraints | input_format | output_format | sample_input | sample_output | supported_languages | test_case_id | test_case_visibility | test_case_input | test_case_output";

function testCaseCounts(validQuestions) {
  let visible = 0;
  let hidden = 0;
  validQuestions.forEach((q) => {
    (q.testCases || []).forEach((tc) => {
      if (tc.isHidden) hidden++;
      else visible++;
    });
  });
  return { visible, hidden };
}

export default function CodingUpload({ source, onAdd, onCancel }) {
  const cfg = FORMAT_MAP[source];
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [clientError, setClientError] = useState("");
  const [expanded, setExpanded] = useState({});
  const inputRef = useRef(null);

  const handleDownload = async () => {
    try {
      const token = getAuthToken();
      const res = await api.get(`/api/coding-questions/templates/${cfg.ext}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `coding_problems_template.${cfg.ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Template downloaded");
    } catch {
      toast.error("Failed to download template");
    }
  };

  const validateFile = (file) => {
    if (!file) return "Please choose a file to upload.";
    const name = file.name.toLowerCase();
    if (!name.endsWith(cfg.ext)) {
      return `Invalid file type. Please upload a ${cfg.label} (.${cfg.ext}) file using the official Coding Problem template.`;
    }
    if (file.size === 0) return "The selected file is empty.";
    if (file.size > 10 * 1024 * 1024) return "File is too large. Maximum size is 10MB.";
    return "";
  };

  const handleFile = async (file) => {
    const err = validateFile(file);
    if (err) {
      setClientError(err);
      setResult(null);
      return;
    }
    setClientError("");
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/api/coding-questions/upload-questions", formData, {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setResult(data);
      if (data.invalidCount > 0) {
        toast.error(`${data.invalidCount} problem(s) need attention`);
      } else if (data.duplicates?.length > 0) {
        toast.error("Duplicate problems detected");
      } else {
        toast.success(`${data.validCount} problems parsed`);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "We couldn't parse this file. Please download the official template and upload the completed version.";
      setClientError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e) => {
    handleFile(e.target.files[0]);
    e.target.value = "";
  };

  const canImport = result && result.invalidCount === 0 && (result.duplicates?.length || 0) === 0;

  const toggle = (i) => setExpanded((p) => ({ ...p, [i]: !p[i] }));

  const counts = result ? testCaseCounts(result.validQuestions || []) : { visible: 0, hidden: 0 };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Upload Coding {cfg.label} File
        </h3>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border admin-border rounded-lg admin-hover cursor-pointer"
          style={{ color: "var(--primary)" }}
        >
          <Download className="w-3.5 h-3.5" /> Download Template
        </button>
      </div>

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
        <input ref={inputRef} type="file" accept={cfg.accept} className="hidden" onChange={handleChange} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Parsing coding problems…</p>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Drop your Coding {cfg.label} template here or click to browse
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{cfg.accept} files only</p>
          </>
        )}
      </div>

      {source === "csv" && (
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Required format:</p>
          <div className="flex flex-wrap gap-1.5">
            {REQUIRED_FORMAT_CSV.split("|").map((c) => (
              <span key={c} className="text-[10px] px-1.5 py-0.5 rounded admin-bg-surface"
                style={{ color: "var(--text-muted)" }}>{c.trim()}</span>
            ))}
          </div>
        </div>
      )}

      {clientError && (
        <div className="p-3 rounded-lg text-xs flex items-start gap-2" style={{ background: "var(--badge-error-bg)", color: "var(--badge-error-text)" }}>
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{clientError}</span>
        </div>
      )}

      {result && (result.invalidCount > 0 || (result.duplicates?.length || 0) > 0) && (
        <div className="border admin-border admin-card rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--badge-error-text)" }}>
            <AlertTriangle className="w-4 h-4" />
            {result.validCount} Valid · {result.invalidCount} Need Attention
          </div>

          {result.duplicates?.length > 0 && (
            <div className="p-3 rounded-lg text-xs space-y-1" style={{ background: "var(--badge-warning-bg)", color: "var(--badge-warning-text)" }}>
              <p className="font-medium">⚠ Duplicate problems detected</p>
              {result.duplicates.map((d, i) => (
                <div key={i}>• {d.label} duplicates {d.firstLabel}</div>
              ))}
            </div>
          )}

          {result.invalidQuestions?.length > 0 && (
            <div className="max-h-60 overflow-y-auto space-y-2">
              {result.invalidQuestions.map((inv, i) => (
                <div key={i} className="p-3 rounded-lg text-xs border admin-border" style={{ color: "var(--badge-error-text)", borderColor: "var(--badge-error-text)" }}>
                  <p className="font-semibold mb-1">{inv.label}{inv.title ? ` — ${inv.title}` : ""}{inv.duplicate ? " (duplicate)" : ""}</p>
                  {inv.errors.map((e, j) => (
                    <div key={j} className="flex items-start gap-1.5">
                      <span>✕</span><span>{e}</span>
                    </div>
                  ))}
                  {inv.testCaseErrors?.map((tc, j) => (
                    <div key={`tc-${j}`} className="mt-1 pl-3 space-y-0.5">
                      <p className="font-medium">{tc.id}</p>
                      {tc.errors.map((e, k) => (
                        <div key={k} className="flex items-start gap-1.5">
                          <span>•</span><span>{e}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Please fix the file using the official template and upload it again. Only fully valid files can be imported.
          </p>
          <button onClick={() => setResult(null)}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium border admin-border rounded-lg admin-hover cursor-pointer"
            style={{ color: "var(--text-secondary)" }}>
            Re-upload File
          </button>
        </div>
      )}

      {result && canImport && (
        <div className="border admin-border admin-card rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--badge-success-text)" }}>
            <FileCheck className="w-4 h-4" /> File parsed successfully — {result.validCount} Valid Problems
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {counts.visible} visible test case(s) · {counts.hidden} hidden test case(s) will be imported.
          </p>

          <div className="overflow-x-auto border admin-border rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--admin-surface-hover)", color: "var(--text-secondary)" }}>
                  <th className="text-left px-2 py-2 font-medium w-8"></th>
                  <th className="text-left px-3 py-2 font-medium">No.</th>
                  <th className="text-left px-3 py-2 font-medium">Problem ID</th>
                  <th className="text-left px-3 py-2 font-medium">Title</th>
                  <th className="text-left px-3 py-2 font-medium">Difficulty</th>
                  <th className="text-left px-3 py-2 font-medium">Marks</th>
                  <th className="text-left px-3 py-2 font-medium">Test Cases</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.validQuestions.map((q, i) => {
                  const tcs = q.testCases || [];
                  const vis = tcs.filter((t) => !t.isHidden).length;
                  const hid = tcs.filter((t) => t.isHidden).length;
                  return (
                    <Fragment key={i}>
                      <tr className="border-t admin-border">
                        <td className="px-2 py-2">
                          <button onClick={() => toggle(i)} className="cursor-pointer" style={{ color: "var(--text-muted)" }}>
                            {expanded[i] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                        <td className="px-3 py-2" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                        <td className="px-3 py-2 font-mono" style={{ color: "var(--text-primary)" }}>{q.questionId}</td>
                        <td className="px-3 py-2 max-w-[220px] truncate" style={{ color: "var(--text-primary)" }} title={q.title}>{q.title}</td>
                        <td className="px-3 py-2 capitalize" style={{ color: "var(--text-primary)" }}>{q.difficulty}</td>
                        <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>{q.marks}</td>
                        <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>
                          {(vis + hid)} <span style={{ color: "var(--text-muted)" }}>({vis}V/{hid}H)</span>
                        </td>
                        <td className="px-3 py-2" style={{ color: "var(--badge-success-text)" }}>✓ Valid</td>
                      </tr>
                      {expanded[i] && (
                        <tr className="border-t admin-border" style={{ background: "var(--admin-surface-hover)" }}>
                          <td></td>
                          <td colSpan={7} className="px-4 py-3 text-xs space-y-1.5" style={{ color: "var(--text-secondary)" }}>
                            <Detail label="Description" value={q.problemStatement} />
                            <Detail label="Constraints" value={q.constraints} />
                            <Detail label="Input Format" value={q.inputFormat} />
                            <Detail label="Output Format" value={q.outputFormat} />
                            <Detail label="Sample Input" value={q.sampleInput} mono />
                            <Detail label="Sample Output" value={q.sampleOutput} mono />
                            <Detail label="Supported Languages" value={(q.supportedLanguages || []).join(", ")} />
                            <div>
                              <span className="font-medium" style={{ color: "var(--text-primary)" }}>Test Cases:</span>
                              <ul className="mt-1 space-y-1">
                                {tcs.map((tc, j) => (
                                  <li key={j} className="flex items-start gap-2">
                                    <span className="px-1.5 py-0.5 rounded text-[10px]"
                                      style={{ background: tc.isHidden ? "var(--badge-warning-bg)" : "var(--badge-success-bg)",
                                        color: tc.isHidden ? "var(--badge-warning-text)" : "var(--badge-success-text)" }}>
                                      {tc.isHidden ? "Hidden" : "Visible"}
                                    </span>
                                    <span className="truncate" style={{ color: "var(--text-muted)" }}>
                                      in: {tc.input} → out: {tc.expected}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button onClick={onCancel}
              className="px-4 py-2 text-xs font-medium border admin-border rounded-lg admin-hover cursor-pointer"
              style={{ color: "var(--text-secondary)" }}>
              Cancel
            </button>
            <button onClick={() => { onAdd(result.validQuestions); setResult(null); }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-lg cursor-pointer"
              style={{ background: "var(--primary)" }}>
              <CheckCircle className="w-3.5 h-3.5" /> Add Problems
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono }) {
  if (!value) return null;
  return (
    <div>
      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{label}:</span>{" "}
      <span className={mono ? "font-mono" : ""} style={{ color: "var(--text-muted)" }}>{value}</span>
    </div>
  );
}
