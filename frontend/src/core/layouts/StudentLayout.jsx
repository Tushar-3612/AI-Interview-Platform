import { useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Navbar from "../../features/student/components/Navbar.jsx";
import StudentSidebar from "../../features/student/components/StudentSidebar.jsx";
import MobileBottomNav from "../../features/student/components/MobileBottomNav.jsx";
import StartInterviewModal from "../../features/student/components/StartInterviewModal.jsx";
import { getAuthToken, useStudentProfile } from "../../features/student/hooks/useStudentProfile.js";

/**
 * Student portal layout — collapsible desktop sidebar + responsive top navbar + mobile drawer & bottom nav.
 */
function StudentLayout() {
  const token = getAuthToken();
  const location = useLocation();
  const { profile, isLoading, updateProfile, saveProfile, refetchProfile, addSkill, removeSkill, getProfileForInterview } =
    useStudentProfile();
  const [interviewModalOpen, setInterviewModalOpen] = useState(false);

  // Desktop sidebar collapse state with localStorage persistence
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("prephire_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  // Mobile off-canvas drawer open state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("prephire_sidebar_collapsed", next ? "true" : "false");
      } catch {
        // noop
      }
      return next;
    });
  };

  if (!token) {
    return <Navigate to="/" replace />;
  }

  // Standalone interview & test assessment room check
  const isInterviewRoute =
    location.pathname === "/interview" ||
    location.pathname.startsWith("/interview/") ||
    location.pathname.startsWith("/company-mock") ||
    location.pathname.startsWith("/tests/attempt/");

  const handleStartInterview = (formData) => {
    updateProfile({
      ...formData,
      interviewStatus: "in_progress",
    });
    setInterviewModalOpen(false);
    toast.success("Launching Interview session in a new tab...");
    window.open("/interview", "_blank", "noopener,noreferrer");
  };

  if (isInterviewRoute) {
    return (
      <Outlet
        context={{
          profile,
          isLoading,
          updateProfile,
          saveProfile,
          refetchProfile,
          addSkill,
          removeSkill,
          getProfileForInterview,
          openInterviewModal: () => setInterviewModalOpen(true),
        }}
      />
    );
  }

  return (
    <div className="app-layout" style={{ background: "var(--bg-primary)" }}>
      {/* Desktop & Mobile Sidebar */}
      <StudentSidebar
        profile={profile}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileDrawerOpen}
        onCloseMobile={() => setMobileDrawerOpen(false)}
      />

      {/* Main Content Area — Resizes smoothly alongside sidebar */}
      <div
        className={`main-content flex flex-col transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64"
        }`}
      >
        <Navbar
          profile={profile}
          onToggleSidebar={handleToggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
          onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
          onStartInterview={() => setInterviewModalOpen(true)}
        />

        <motion.main
          className="flex-1 pb-20 lg:pb-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
      <Outlet
        context={{
          profile,
          isLoading,
          updateProfile,
          saveProfile,
          refetchProfile,
          addSkill,
          removeSkill,
          getProfileForInterview,
          openInterviewModal: () => setInterviewModalOpen(true),
        }}
      />
        </motion.main>
      </div>

      {/* Mobile Bottom Quick Navigation */}
      <MobileBottomNav onOpenMobileDrawer={() => setMobileDrawerOpen(true)} />

      {/* Start Interview Modal */}
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
