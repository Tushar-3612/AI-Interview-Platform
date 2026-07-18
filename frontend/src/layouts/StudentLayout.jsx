import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
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
  const { profile, updateProfile, getProfileForInterview } = useStudentProfile();
  const [interviewModalOpen, setInterviewModalOpen] = useState(false);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  const handleStartInterview = (formData) => {
    updateProfile({
      ...formData,
      interviewStatus: "in_progress",
    });
    setInterviewModalOpen(false);
    toast.success("Interview session ready. Full interview module coming soon.");
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
        onClose={() => setInterviewModalOpen(false)}
        profile={profile}
        onFillProfile={() => toast.success("Profile data filled")}
        onSubmit={handleStartInterview}
      />
    </div>
  );
}

export default StudentLayout;
