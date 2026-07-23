import { Routes, Route } from "react-router-dom";
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
import StudentInterview from "../pages/student/StudentInterview";

import AdminLayout from "../layouts/AdminLayout";
import AdminDashboard from "../pages/admin/AdminDashboard";
import StudentsList from "../pages/admin/StudentsList";
import StudentDetails from "../pages/admin/StudentDetails";
import CreateTest from "../pages/admin/CreateTest";
import AssignedTests from "../pages/admin/AssignedTests";
import ReportsModule from "../pages/admin/ReportsModule";
import CompanyManagement from "../pages/admin/CompanyManagement";
import EmailManagement from "../pages/admin/EmailManagement";
import NotificationsPage from "../pages/admin/NotificationsPage";
import AuditLogs from "../pages/admin/AuditLogs";
import SystemConfig from "../pages/admin/SystemConfig";
import BackupDashboard from "../pages/admin/BackupDashboard";

import RoundSelection from "../pages/student/RoundSelection";
import AptitudeRound from "../pages/student/AptitudeRound";
import CodingRound from "../pages/student/CodingRound";
import InterviewResult from "../pages/student/InterviewResult";
import AvailableTests from "../pages/student/AvailableTests";
import TestEngine from "../pages/student/TestEngine";
import TestResult from "../pages/student/TestResult";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/registration-success" element={<RegistrationSuccess />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />

      <Route element={<StudentLayout />}>
        <Route path="/dashboard" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/interview" element={<StudentInterview />} />
        <Route path="/interview-practice" element={<InterviewPractice />} />
        <Route path="/interview-practice/:companyId" element={<RoundSelection />} />
        <Route path="/interview-practice/:companyId/aptitude" element={<AptitudeRound />} />
        <Route path="/interview-practice/:companyId/technical" element={<PracticeQuestion />} />
        <Route path="/interview-practice/:companyId/coding" element={<CodingRound />} />
        <Route path="/interview-practice/:companyId/result" element={<InterviewResult />} />
        <Route path="/tests" element={<AvailableTests />} />
        <Route path="/tests/attempt/:attemptId" element={<TestEngine />} />
        <Route path="/tests/result/:attemptId" element={<TestResult />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/interview-history" element={<InterviewHistory />} />
        <Route path="/results" element={<Results />} />
      </Route>

      <Route element={<AdminLayout />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/students" element={<StudentsList />} />
        <Route path="/admin/students/:id" element={<StudentDetails />} />
        <Route path="/admin/tests/create" element={<CreateTest />} />
        <Route path="/admin/tests/assigned" element={<AssignedTests />} />
        <Route path="/admin/reports" element={<ReportsModule />} />
        <Route path="/admin/companies" element={<CompanyManagement />} />
        <Route path="/admin/email" element={<EmailManagement />} />
        <Route path="/admin/notifications" element={<NotificationsPage />} />
        <Route path="/admin/audit-logs" element={<AuditLogs />} />
        <Route path="/admin/config" element={<SystemConfig />} />
        <Route path="/admin/backup" element={<BackupDashboard />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
