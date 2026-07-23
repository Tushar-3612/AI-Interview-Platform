import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Check, ClipboardList } from "lucide-react";
import api from "../../utils/api";
import { getAuthToken } from "../../hooks/useStudentProfile";
import toast from "react-hot-toast";

import Step1GeneralInfo from "../../components/admin/steps/Step1GeneralInfo";
import Step2QuestionSource from "../../components/admin/steps/Step2QuestionSource";
import Step3AssignTest from "../../components/admin/steps/Step3AssignTest";
import Step4PreviewTest from "../../components/admin/steps/Step4PreviewTest";
import Step5PublishTest from "../../components/admin/steps/Step5PublishTest";

const initialForm = {
  title: "",
  description: "",
  companyId: "",
  testType: "aptitude",
  difficulty: "Medium",
  duration: 30,
  passingMarks: 40,
  attemptLimit: 1,
  questionSource: "manual",
  status: "draft",
  scheduledAt: "",
  subjects: [],
  codingLanguages: [],
  questions: [],
};

const steps = [
  { id: "general", label: "General Information" },
  { id: "questions", label: "Question Source" },
  { id: "assign", label: "Assign" },
  { id: "preview", label: "Preview" },
  { id: "publish", label: "Publish" },
];

function CreateTest() {
  const navigate = useNavigate();
  const token = getAuthToken();

  const [form, setForm] = useState(initialForm);
  const [testId, setTestId] = useState(null);
  const [testCreated, setTestCreated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignTargets, setAssignTargets] = useState({ assignType: "all", assignValue: "", studentIds: [] });
  const [currentStep, setCurrentStep] = useState(0);

  const questions = form.questions || [];

  const saveTest = async (status) => {
    if (!form.title?.trim()) {
      toast.error("Test name is required");
      return null;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        status: status || form.status,
        questions,
      };
      let data;
      if (testId) {
        const res = await api.put(`/api/tests/${testId}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        data = res.data;
        toast.success("Test updated");
      } else {
        const res = await api.post("/api/tests", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        data = res.data;
        setTestId(data.test._id);
        setTestCreated(true);
        toast.success("Test created");
      }
      return data;
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save test");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const data = await saveTest("live");
    if (data) {
      toast.success("Test published!");
      navigate("/admin/tests/assigned");
    }
  };

  const handleAssign = async () => {
    if (!testId) {
      const data = await saveTest("draft");
      if (!data) return;
    }
    setSaving(true);
    try {
      await api.post("/api/tests/assign", {
        testId,
        assignType: assignTargets.assignType,
        assignValue: assignTargets.assignValue,
        studentIds: assignTargets.studentIds,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Test assigned successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Assignment failed");
    } finally {
      setSaving(false);
    }
  };

  const validateStep = () => {
    switch (steps[currentStep]?.id) {
      case "general":
        if (!form.title?.trim()) { toast.error("Test name is required"); return false; }
        return true;
      case "questions":
        if (questions.length === 0) { toast.error("Add at least one question before proceeding"); return false; }
        return true;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    if (steps[currentStep]?.id === "assign") {
      await handleAssign();
    }
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const renderStep = () => {
    switch (steps[currentStep]?.id) {
      case "general":
        return <Step1GeneralInfo form={form} onChange={setForm} />;
      case "questions":
        return <Step2QuestionSource form={form} onChange={setForm} />;
      case "assign":
        return (
          <Step3AssignTest
            assignTargets={assignTargets}
            onAssignChange={setAssignTargets}
            testId={testId}
          />
        );
      case "preview":
        return <Step4PreviewTest form={form} questions={questions} />;
      case "publish":
        return (
          <Step5PublishTest
            form={form}
            questions={questions}
            saving={saving}
            testCreated={testCreated}
            testId={testId}
            onSaveDraft={() => saveTest("draft")}
            onPublish={handlePublish}
          />
        );
      default:
        return null;
    }
  };

  useEffect(() => {
    if (currentStep >= steps.length) setCurrentStep(steps.length - 1);
  }, [currentStep]);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Create Test</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Step {currentStep + 1} of {steps.length}: {steps[currentStep]?.label}
          </p>
        </div>
        {testCreated && (
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--badge-success-bg)", color: "var(--badge-success-text)" }}>
            <Check className="w-3.5 h-3.5" />
            Test Saved
          </div>
        )}
      </div>

      {/* ── Progress Bar ── */}
      <div className="flex gap-1 p-1 rounded-xl admin-bg-surface border admin-border overflow-x-auto">
        {steps.map((s, idx) => {
          const isActive = idx === currentStep;
          const isDone = idx < currentStep;
          return (
            <button key={s.id} onClick={() => isDone && setCurrentStep(idx)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap transition-all flex-1 justify-center ${
                isActive ? "shadow-sm border admin-border admin-card" : ""
              } ${isDone ? "admin-hover" : ""}`}
              style={{
                color: isActive ? "var(--primary)" : isDone ? "var(--text-secondary)" : "var(--text-muted)",
              }}
            >
              {isDone ? <Check className="w-3 h-3" style={{ color: "var(--success)" }} /> : (
                <span className="w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
                  style={{
                    background: isActive ? "var(--primary)" : "var(--admin-surface-hover)",
                    color: isActive ? "#fff" : "var(--text-muted)",
                  }}>{idx + 1}</span>
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Step Content ── */}
      <AnimatePresence mode="wait">
        <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      {/* ── Navigation ── */}
      {steps[currentStep]?.id !== "publish" && (
        <div className="flex items-center justify-between pt-2">
          <div>
            {currentStep > 0 && (
              <button onClick={handlePrev}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium border admin-border rounded-lg admin-hover cursor-pointer">
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {questions.length > 0 && `${questions.length} questions`}
            </span>
            <button onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-lg cursor-pointer"
              style={{ background: "var(--primary)" }}>
              {currentStep === steps.length - 2 ? "Finish" : "Next"} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {testCreated && (
        <div className="flex justify-center">
          <button onClick={() => navigate("/admin/tests/assigned")}
            className="flex items-center gap-1.5 text-xs font-medium admin-hover px-3 py-1.5 rounded-lg cursor-pointer"
            style={{ color: "var(--text-secondary)" }}>
            <ClipboardList className="w-3.5 h-3.5" /> View Assigned Tests
          </button>
        </div>
      )}
    </div>
  );
}

export default CreateTest;
