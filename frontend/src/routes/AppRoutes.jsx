import { Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import RegistrationSuccess from "../pages/RegistrationSuccess";
import TermsAndConditions from "../pages/legal/TermsAndConditions";
import PrivacyPolicy from "../pages/legal/PrivacyPolicy";
import StudentLayout from "../layouts/StudentLayout";
import StudentDashboard from "../pages/StudentDashboard";
import Profile from "../pages/student/Profile";
import InterviewPractice from "../pages/student/InterviewPractice";
import RoundSelection from "../pages/student/RoundSelection";
import About from "../pages/student/About";
import Contact from "../pages/student/Contact";
import InterviewHistory from "../pages/student/InterviewHistory";
import Results from "../pages/student/Results";
import StudentInterview from "../pages/student/StudentInterview";
import StartInterview from "../pages/student/StartInterview";

import AdminLayout from "../layouts/AdminLayout";
import AdminDashboard from "../pages/admin/AdminDashboard";
import StudentsList from "../pages/admin/StudentsList";
import StudentDetails from "../pages/admin/StudentDetails";
import CreateTest from "../pages/admin/CreateTest";
import AssignedTests from "../pages/admin/AssignedTests";
import ReportsModule from "../pages/admin/ReportsModule";
import CompanyManagement from "../pages/admin/CompanyManagement";
import CodingQuestionManagement from "../pages/admin/CodingQuestionManagement";
import AptitudeManagement from "../pages/admin/AptitudeManagement";
import EmailManagement from "../pages/admin/EmailManagement";
import NotificationsPage from "../pages/admin/NotificationsPage";
import AuditLogs from "../pages/admin/AuditLogs";
import SystemConfig from "../pages/admin/SystemConfig";
import BackupDashboard from "../pages/admin/BackupDashboard";

import AptitudeRound from "../pages/student/AptitudeRound";
import CodingRound from "../pages/student/CodingRound";
import AptitudeHistory from "../pages/student/AptitudeHistory";
import CodingHistory from "../pages/student/CodingHistory";
import Bookmarks from "../pages/student/Bookmarks";
import AvailableTests from "../pages/student/AvailableTests";
import TestEngine from "../pages/student/TestEngine";
import TestResult from "../pages/student/TestResult";
import PlacementDashboard from "../pages/student/PlacementDashboard";
import Leaderboard from "../pages/student/Leaderboard";
import MockOA from "../pages/student/MockOA";
import CompanyMockInterview from "../pages/student/CompanyMockInterview";
import CompanyMockHistory from "../pages/student/CompanyMockHistory";
import CompanyAnalytics from "../pages/student/CompanyAnalytics";
import PerformanceGraphs from "../pages/student/PerformanceGraphs";
import QuestionAnalytics from "../pages/student/QuestionAnalytics";
import Achievements from "../pages/student/Achievements";
import AdminPlacementAnalytics from "../pages/admin/PlacementAnalytics";
import AdminTechnicalManagement from "../pages/admin/AdminTechnicalManagement";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/registration-success" element={<RegistrationSuccess />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />

      <Route element={<StudentLayout />}>
        <Route path="/dashboard" element={<StudentDashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/interview" element={<StartInterview />} />
        <Route path="/interview/:sessionId" element={<StartInterview />} />
        <Route path="/interview-practice" element={<InterviewPractice />} />
        <Route path="/interview-practice/:companyId" element={<RoundSelection />} />
        <Route path="/interview-practice/:companyId/aptitude" element={<AptitudeRound />} />
        <Route path="/interview-practice/:companyId/coding" element={<CodingRound />} />
        <Route path="/practice/aptitude/history" element={<AptitudeHistory />} />
        <Route path="/practice/coding/history" element={<CodingHistory />} />
        <Route path="/practice/bookmarks" element={<Bookmarks />} />
        <Route path="/tests" element={<AvailableTests />} />
        <Route path="/tests/attempt/:attemptId" element={<TestEngine />} />
        <Route path="/tests/result/:attemptId" element={<TestResult />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/interview-history" element={<InterviewHistory />} />
        <Route path="/results" element={<Results />} />
        <Route path="/placement-dashboard" element={<PlacementDashboard />} />
        <Route path="/placement/leaderboard" element={<Leaderboard />} />
        <Route path="/placement/mock-oa" element={<MockOA />} />
        <Route path="/company-mock" element={<CompanyMockInterview />} />
        <Route path="/company-mock/history" element={<CompanyMockHistory />} />
        <Route path="/placement/company-analytics" element={<CompanyAnalytics />} />
        <Route path="/placement/performance" element={<PerformanceGraphs />} />
        <Route path="/placement/question-analytics" element={<QuestionAnalytics />} />
        <Route path="/placement/achievements" element={<Achievements />} />
      </Route>

      <Route element={<AdminLayout />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/students" element={<StudentsList />} />
        <Route path="/admin/students/:id" element={<StudentDetails />} />
        <Route path="/admin/tests/create" element={<CreateTest />} />
        <Route path="/admin/tests/assigned" element={<AssignedTests />} />
        <Route path="/admin/reports" element={<ReportsModule />} />
        <Route path="/admin/companies" element={<CompanyManagement />} />
        <Route path="/admin/coding-questions" element={<CodingQuestionManagement />} />
        <Route path="/admin/aptitude-questions" element={<AptitudeManagement />} />
        <Route path="/admin/email" element={<EmailManagement />} />
        <Route path="/admin/notifications" element={<NotificationsPage />} />
        <Route path="/admin/audit-logs" element={<AuditLogs />} />
        <Route path="/admin/config" element={<SystemConfig />} />
        <Route path="/admin/backup" element={<BackupDashboard />} />
        <Route path="/admin/placement-analytics" element={<AdminPlacementAnalytics />} />
        <Route path="/admin/technical-questions" element={<AdminTechnicalManagement />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
