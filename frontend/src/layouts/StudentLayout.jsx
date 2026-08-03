import { useState } from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Navbar from "../components/student/Navbar";
import StartInterviewModal from "../components/student/StartInterviewModal";
import { getAuthToken } from "../hooks/useStudentProfile";
import { useStudentProfile } from "../hooks/useStudentProfile";

/**
 * Student portal layout — sticky navbar, no sidebar.
 */
function StudentLayout() {
  const token = getAuthToken();
  const navigate = useNavigate();
  const { profile, updateProfile, getProfileForInterview } = useStudentProfile();
  const [interviewModalOpen, setInterviewModalOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  const handleStartInterview = async (formData) => {
    setIsStarting(true);
    const startToast = toast.loading("🤖 Generating your interview questions...");

    try {
      const authToken = getAuthToken();
      const res = await fetch("http://localhost:5000/api/interview/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          interviewType: formData.interviewType,
          difficulty: formData.difficulty,
          duration: formData.duration || 30,
          candidateName: profile.name || "",
          resumeFileName: profile.resumeFileName || "",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to start interview");
      }

      // Persist the new interviewId in the profile for later saves
      updateProfile({
        ...formData,
        interviewStatus: "in_progress",
        interviewId: data.interviewId,
      });

      toast.success("Questions ready! Starting interview...", { id: startToast });
      setInterviewModalOpen(false);

      // Pass pre-fetched data via router state so StartInterview doesn't need to re-fetch
      navigate("/start-interview", {
        state: {
          interviewId: data.interviewId,
          generatedQuestions: data.generatedQuestions,
          interviewType: formData.interviewType,
          difficulty: formData.difficulty,
          duration: formData.duration || 30,
          candidateName: profile.name || "Candidate",
          resumeFileName: profile.resumeFileName || "",
        },
      });
    } catch (err) {
      console.error("Start Interview Error:", err);
      toast.error(err.message || "Could not start interview. Please try again.", { id: startToast });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
      <Navbar onStartInterview={() => setInterviewModalOpen(true)} />

      <motion.main
        className="flex-1"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Outlet
          context={{
            profile,
            updateProfile,
            getProfileForInterview,
            openInterviewModal: () => setInterviewModalOpen(true),
          }}
        />
      </motion.main>

      <StartInterviewModal
        open={interviewModalOpen}
        onClose={() => !isStarting && setInterviewModalOpen(false)}
        profile={profile}
        isStarting={isStarting}
        onFillProfile={() => toast.success("Profile data filled")}
        onSubmit={handleStartInterview}
      />
    </div>
  );
}

export default StudentLayout;
