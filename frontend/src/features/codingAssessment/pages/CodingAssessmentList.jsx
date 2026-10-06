import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2,
  Clock,
  Award,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
  FileCode,
  Info,
  History,
} from "lucide-react";
import api from "../../../core/api/api.js";
import { getAuthToken } from "../../student/hooks/useStudentProfile.js";
import toast from "react-hot-toast";

export default function CodingAssessmentList() {
  const navigate = useNavigate();
  const token = getAuthToken();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [instructionsModalOpen, setInstructionsModalOpen] = useState(false);
  const [startingId, setStartingId] = useState(null);

  useEffect(() => {
    const fetchAssessments = async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/coding/assessments", { headers });
        setAssessments(res.data?.data || []);
      } catch (err) {
        toast.error("Failed to load assessments.");
      } finally {
        setLoading(false);
      }
    };

    fetchAssessments();
  }, [headers]);

  const handleOpenInstructions = (ass) => {
    setSelectedAssessment(ass);
    setInstructionsModalOpen(true);
  };

  const handleStart = async (assessmentId) => {
    setStartingId(assessmentId);
    try {
      const res = await api.post(`/api/coding/assessments/${assessmentId}/start`, {}, { headers });
      const data = res.data?.data;
      if (data?.completed) {
        toast("Assessment already completed. Viewing results...", { icon: "ℹ️" });
        navigate(`/coding-assessment/result/${data.attemptId}`);
        return;
      }

      toast.success("Starting coding assessment...");
      navigate(`/coding-assessment/${assessmentId}?attempt=${data.attemptId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start assessment.");
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div className="page-container space-y-6 pb-24 lg:pb-8">
      {/* Hero Header */}
      <section className="page-hero space-y-4">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border bg-[#FF6B35]/10 border-[#FF6B35]/30 text-[#FF6B35]">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--text-primary)]">
                  Coding Round Assessments
                </h1>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/30">
                  Admin Managed
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
                Take official technical screening assessments configured by your institution. All challenges are evaluated against automated testcase suites via our integrated Monaco IDE.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/coding-assessment/history")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold text-[var(--text-primary)] border-[#FF6B35]/35 bg-[#FF6B35]/10 hover:bg-[#FF6B35]/20 transition cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-[#FF6B35]" />
              <span>Assessment History</span>
            </button>
          </div>
        </div>
      </section>

      {/* Assessments Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FileCode className="w-4 h-4 text-[#FF6B35]" />
            Active Assessments ({assessments.length})
          </h2>
          <span className="text-xs text-[var(--text-muted)]">
            Only admin-published assessments are shown
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-[var(--text-muted)]">
            Loading active coding assessments...
          </div>
        ) : assessments.length === 0 ? (
          <div className="py-16 text-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)]/30 space-y-2">
            <AlertCircle className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-60" />
            <h3 className="font-bold text-sm sm:text-base text-[var(--text-primary)]">
              No Active Coding Assessments
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
              There are currently no active coding assessments scheduled. Once your administrator activates an assessment, it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assessments.map((ass) => {
              const attempt = ass.attempt;
              const isCompleted = attempt && ["SUBMITTED", "AUTO_SUBMITTED"].includes(attempt.status);
              const isInProgress = attempt && attempt.status === "IN_PROGRESS";

              return (
                <motion.div
                  key={ass._id}
                  whileHover={{ y: -3 }}
                  className="p-5 rounded-2xl border bg-[var(--card-bg)] shadow-[var(--shadow-card)] flex flex-col justify-between space-y-4"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-[#FF6B35]/10 border border-[#FF6B35]/25 flex items-center justify-center text-[#FF6B35]">
                        <Code2 className="w-5 h-5" />
                      </div>

                      {isCompleted ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed ({attempt.percentage}%)
                        </span>
                      ) : isInProgress ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                          <Clock className="w-3 h-3" />
                          In Progress
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF6B35]/15 text-[#FF6B35] border border-[#FF6B35]/30">
                          Active
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold text-[var(--text-primary)] line-clamp-1">
                        {ass.title}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-1 leading-relaxed">
                        {ass.description || "Official technical screening coding assessment."}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center text-xs" style={{ borderColor: "var(--border)" }}>
                      <div className="p-2 rounded-xl bg-[var(--bg-secondary)]">
                        <span className="text-[10px] text-[var(--text-muted)] block">Duration</span>
                        <span className="font-bold text-[var(--text-primary)]">{ass.durationMinutes}m</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[var(--bg-secondary)]">
                        <span className="text-[10px] text-[var(--text-muted)] block">Questions</span>
                        <span className="font-bold text-[var(--text-primary)]">{ass.questionCount}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[var(--bg-secondary)]">
                        <span className="text-[10px] text-[var(--text-muted)] block">Total</span>
                        <span className="font-bold text-[#FF6B35]">{ass.totalMarks} pts</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    {isCompleted ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/coding-assessment/result/${attempt._id}`)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border border-[#FF6B35]/40 text-[#FF6B35] hover:bg-[#FF6B35]/10 transition cursor-pointer"
                      >
                        <span>View Results</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : isInProgress ? (
                      <button
                        type="button"
                        onClick={() => handleStart(ass._id)}
                        disabled={startingId === ass._id}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black text-white bg-amber-500 hover:bg-amber-600 transition cursor-pointer shadow-md shadow-amber-500/20"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Resume Assessment</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenInstructions(ass)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:opacity-95 transition cursor-pointer shadow-md shadow-[#FF6B35]/25"
                      >
                        <span>Instructions & Start</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Instructions Modal */}
      <AnimatePresence>
        {instructionsModalOpen && selectedAssessment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl border p-6 bg-[var(--card-bg)] text-[var(--text-primary)] space-y-4 shadow-2xl"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-[#FF6B35]" />
                  <h3 className="text-base font-extrabold">{selectedAssessment.title}</h3>
                </div>
                <button
                  onClick={() => setInstructionsModalOpen(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                <p>Please read these instructions carefully before initiating the coding assessment:</p>

                <div className="p-3.5 rounded-xl border bg-[var(--bg-secondary)] space-y-2" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between font-bold text-[var(--text-primary)]">
                    <span>Duration:</span>
                    <span className="font-mono text-[#FF6B35]">{selectedAssessment.durationMinutes} Minutes</span>
                  </div>
                  <div className="flex items-center justify-between font-bold text-[var(--text-primary)]">
                    <span>Total Questions:</span>
                    <span>{selectedAssessment.questionCount} Problems</span>
                  </div>
                  <div className="flex items-center justify-between font-bold text-[var(--text-primary)]">
                    <span>Total Marks:</span>
                    <span>{selectedAssessment.totalMarks} Points</span>
                  </div>
                </div>

                <ul className="space-y-1.5 list-disc pl-4">
                  <li><strong>Deterministic Evaluation:</strong> Code is compiled and evaluated against hidden test cases via Judge0.</li>
                  <li><strong>Multiple Languages:</strong> Supported languages include Python, C++, Java, C, and JavaScript.</li>
                  <li><strong>Authoritative Timer:</strong> The countdown continues even if you refresh your browser. When time expires, your code is auto-submitted.</li>
                  <li><strong>Autosave:</strong> Your code is automatically saved periodically.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setInstructionsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border hover:bg-[var(--bg-secondary)] transition cursor-pointer"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInstructionsModalOpen(false);
                    handleStart(selectedAssessment._id);
                  }}
                  disabled={startingId === selectedAssessment._id}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-[#FF6B35] to-[#FF8A3D] hover:opacity-95 shadow-md shadow-[#FF6B35]/25 transition cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Begin Assessment</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
