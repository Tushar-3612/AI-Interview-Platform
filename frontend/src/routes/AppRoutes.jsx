import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import RegistrationSuccess from "../pages/RegistrationSuccess";
import TermsAndConditions from "../pages/legal/TermsAndConditions";
import PrivacyPolicy from "../pages/legal/PrivacyPolicy";
import StudentLayout from "../layouts/StudentLayout";
import Home from "../pages/student/Home";
import Profile from "../pages/student/Profile";
import InterviewPractice from "../pages/student/InterviewPractice";
import PracticeQuestion from "../pages/student/PracticeQuestion";
import About from "../pages/student/About";
import Contact from "../pages/student/Contact";
import InterviewHistory from "../pages/student/InterviewHistory";
import Results from "../pages/student/Results";
import StartInterview from "../pages/student/StartInterview";
import AdminDashboard from "../pages/admin/AdminDashboard";
import { getAuthToken, getAuthUser } from "../hooks/useStudentProfile";

/**
 * Guard component — redirects to login if not authenticated,
 * or to dashboard if role doesn't match.
 */
function ProtectedAdminRoute() {
  const token = getAuthToken();
  const user = getAuthUser();

  if (!token) return <Navigate to="/" replace />;
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;

  return <AdminDashboard />;
}

/**
 * Application route definitions.
 */
function AppRoutes() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/registration-success" element={<RegistrationSuccess />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />

      {/* Admin portal */}
      <Route path="/admin/dashboard" element={<ProtectedAdminRoute />} />

      {/* Standalone Interview Room */}
      <Route path="/start-interview" element={<StartInterview />} />

      {/* Student portal */}
      <Route element={<StudentLayout />}>
        <Route path="/dashboard" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/interview-practice" element={<InterviewPractice />} />
        <Route path="/interview-practice/:companyId" element={<PracticeQuestion />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/interview-history" element={<InterviewHistory />} />
        <Route path="/results" element={<Results />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
