import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileText, Clock, BookOpen, Code, BarChart, Play, CheckCircle,
  AlertCircle, Calendar, Users, Building2, ChevronRight,
} from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

const statusConfig = {
  upcoming: {
    label: "Upcoming", color: "var(--badge-info-text)",
    bg: "var(--badge-info-bg)", icon: Calendar,
  },
  available: {
    label: "Available", color: "var(--badge-success-text)",
    bg: "var(--badge-success-bg)", icon: Clock,
  },
  started: {
    label: "In Progress", color: "var(--badge-warning-text)",
    bg: "var(--badge-warning-bg)", icon: Play,
  },
  completed: {
    label: "Completed", color: "var(--text-muted)",
    bg: "var(--admin-bg-surface)", icon: CheckCircle,
  },
  expired: {
    label: "Expired", color: "var(--badge-error-text)",
    bg: "var(--badge-error-bg)", icon: AlertCircle,
  },
};

function TestInstructions({ test, onAgree, onClose }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#111] rounded-2xl border border-gray-200 dark:border-zinc-800 w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="p-6 space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
              <FileText className="w-7 h-7" style={{ color: "var(--primary)" }} />
            </div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{test.title}</h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{test.companyId || "General Assessment"}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              ["Duration", `${test.duration} minutes`],
              ["Total Questions", test.totalQuestions],
              ["Total Marks", test.totalMarks],
              ["Passing Marks", `${test.passingMarks}%`],
              ["Type", test.testType?.charAt(0).toUpperCase() + test.testType?.slice(1)],
              ["Difficulty", test.difficulty],
            ].map(([l, v]) => (
              <div key={l} className="p-3 rounded-xl admin-bg-surface text-center">
                <p style={{ color: "var(--text-muted)" }}>{l}</p>
                <p className="font-semibold mt-0.5" style={{ color: "var(--text-primary)" }}>{v}</p>
              </div>
            ))}
          </div>

          <div className="text-xs space-y-2 p-4 rounded-xl" style={{ background: "var(--badge-warning-bg)" }}>
            <h4 className="font-semibold flex items-center gap-1.5" style={{ color: "var(--badge-warning-text)" }}>
              <AlertCircle className="w-3.5 h-3.5" /> Important Rules
            </h4>
            <ul className="space-y-1" style={{ color: "var(--text-secondary)" }}>
              <li>• Do not switch tabs or windows during the test.</li>
              <li>• 1st tab switch → Warning | 2nd → Final Warning | 3rd → Auto Submit.</li>
              <li>• The test will auto-submit when the timer reaches 0.</li>
              <li>• Answered questions are saved automatically.</li>
              <li>• You can skip questions and return later.</li>
              <li>• Mark questions for review using the "Mark for Review" button.</li>
            </ul>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
            style={{ background: agreed ? "color-mix(in srgb, var(--success) 8%, transparent)" : "var(--admin-bg-surface)" }}>
            <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
              className="w-4 h-4 rounded" />
            <span className="text-xs" style={{ color: "var(--text-primary)" }}>
              I agree to the test rules and understand that tab switching may result in auto-submission.
            </span>
          </label>

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-xs font-medium border admin-border rounded-xl admin-hover cursor-pointer">
              Cancel
            </button>
            <button onClick={onAgree} disabled={!agreed}
              className="flex-1 py-2.5 text-xs font-medium text-white rounded-xl cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              style={{ background: "var(--primary)" }}>
              <Play className="w-3.5 h-3.5" /> Start Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AvailableTests() {
  const navigate = useNavigate();
  const token = getAuthToken();

  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [instructions, setInstructions] = useState(null);
  const [starting, setStarting] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get("/api/student/tests", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTests(data || []);
      } catch {
        toast.error("Failed to load tests");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [token]);

  const handleStart = async (testId) => {
    setStarting(testId);
    try {
      const { data } = await api.post(`/api/student/tests/${testId}/start`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate(`/tests/attempt/${data.attempt._id}`, {
        state: { test: data.test, attempt: data.attempt },
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start test");
    } finally {
      setStarting(null);
      setInstructions(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>My Tests</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Tests assigned to you by your instructors.</p>
      </div>

      {tests.length === 0 && (
        <div className="border admin-border admin-card rounded-2xl p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>No Tests Assigned</h3>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>You don't have any tests assigned yet.</p>
        </div>
      )}

      <div className="grid gap-4">
        {tests.map((test, idx) => {
          const cfg = statusConfig[test.testStatus] || statusConfig.available;
          const StatusIcon = cfg.icon;

          return (
            <motion.div key={test._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}
              className="border admin-border admin-card rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>
                        {test.title}
                      </h3>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0`}
                        style={{ background: cfg.bg, color: cfg.color }}>
                        <StatusIcon className="w-3 h-3" /> {cfg.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      {test.companyId && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {test.companyId}
                        </span>
                      )}
                      <span className="flex items-center gap-1 capitalize">
                        <BookOpen className="w-3 h-3" /> {test.testType}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {test.duration} min
                      </span>
                      <span className="flex items-center gap-1">
                        <BarChart className="w-3 h-3" /> {test.totalMarks} marks
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" /> {test.totalQuestions} questions
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {(test.testStatus === "available" || test.testStatus === "started") && (
                      <button onClick={() => {
                        if (test.testStatus === "started") {
                          navigate(`/tests/attempt/${test.attemptId}`, { state: { test } });
                        } else {
                          setInstructions(test);
                        }
                      }}
                        disabled={starting === test._id}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-xl cursor-pointer disabled:opacity-50"
                        style={{ background: "var(--primary)" }}>
                        {starting === test._id ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : test.testStatus === "started" ? (
                          <><Play className="w-3.5 h-3.5" /> Resume</>
                        ) : (
                          <><Play className="w-3.5 h-3.5" /> Start</>
                        )}
                      </button>
                    )}
                    {test.testStatus === "completed" && (
                      <button onClick={() => navigate(`/tests/result/${test.attemptId}`)}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium border admin-border rounded-xl admin-hover cursor-pointer">
                        <CheckCircle className="w-3.5 h-3.5" /> View Result
                      </button>
                    )}
                    {test.testStatus === "upcoming" && (
                      <span className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium border admin-border rounded-xl opacity-60">
                        <Calendar className="w-3.5 h-3.5" /> Scheduled
                      </span>
                    )}
                    {test.testStatus === "expired" && (
                      <span className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium border admin-border rounded-xl opacity-60"
                        style={{ color: "var(--badge-error-text)" }}>
                        <AlertCircle className="w-3.5 h-3.5" /> Expired
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {instructions && (
        <TestInstructions
          test={instructions}
          onAgree={() => handleStart(instructions._id)}
          onClose={() => setInstructions(null)}
        />
      )}
    </div>
  );
}

export default AvailableTests;
