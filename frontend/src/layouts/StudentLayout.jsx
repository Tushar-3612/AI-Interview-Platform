import { useState, useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Navbar from "../components/student/Navbar";
import StudentSidebar from "../components/student/StudentSidebar";
import MobileBottomNav from "../components/student/MobileBottomNav";
import StartInterviewModal from "../components/student/StartInterviewModal";
import { getAuthToken, useStudentProfile } from "../hooks/useStudentProfile";

/**
 * Student portal layout — collapsible desktop sidebar + responsive top navbar + mobile drawer & bottom nav.
 */
function StudentLayout() {
  const token = getAuthToken();
  const location = useLocation();
  const { profile, isLoading, updateProfile, saveProfile, refetchProfile, addSkill, removeSkill, getProfileForInterview } =
    useStudentProfile();
  const [interviewModalOpen, setInterviewModalOpen] = useState(false);

  // Smooth scroll to top on nav route switch
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

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

  // Standalone interview room check
  const isInterviewRoute =
    location.pathname === "/interview" ||
    location.pathname.startsWith("/interview/") ||
    location.pathname.startsWith("/company-mock");

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
    <div className="min-h-screen flex" style={{ background: "var(--bg-primary)" }}>
      {/* Desktop & Mobile Sidebar */}
      <StudentSidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileDrawerOpen}
        onCloseMobile={() => setMobileDrawerOpen(false)}
      />

      {/* Main Content Area — Resizes smoothly alongside sidebar */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64"
        }`}
      >
        <Navbar
          onToggleSidebar={handleToggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
          onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
          onStartInterview={() => setInterviewModalOpen(true)}
        />

        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            className="flex-1 pb-20 lg:pb-8"
            initial={{ opacity: 0, y: 14, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(3px)" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
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
        </AnimatePresence>
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
