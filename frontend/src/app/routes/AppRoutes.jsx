import { Routes, Route } from "react-router-dom";
import Login from "../../features/auth/pages/Login.jsx";
import Signup from "../../features/auth/pages/Signup.jsx";


import RegistrationSuccess from "../../features/auth/pages/RegistrationSuccess.jsx";
import TermsAndConditions from "../../features/legal/pages/TermsAndConditions.jsx";
import PrivacyPolicy from "../../features/legal/pages/PrivacyPolicy.jsx";
import StudentLayout from "../../core/layouts/StudentLayout.jsx";
import StudentDashboard from "../../features/student/pages/StudentDashboard.jsx";
import Profile from "../../features/student/pages/Profile.jsx";
import InterviewPractice from "../../features/testEngine/pages/InterviewPractice.jsx";
import RoundSelection from "../../features/testEngine/pages/RoundSelection.jsx";
import About from "../../features/student/pages/About.jsx";
import Contact from "../../features/student/pages/Contact.jsx";
import InterviewHistory from "../../features/realInterview/pages/InterviewHistory.jsx";
import Results from "../../features/realInterview/pages/Results.jsx";
import StudentInterview from "../../features/realInterview/pages/StudentInterview.jsx";
import StartInterview from "../../features/realInterview/pages/StartInterview.jsx";

import AdminLayout from "../../core/layouts/AdminLayout.jsx";
import AdminDashboard from "../../features/administration/pages/AdminDashboard.jsx";
import SystemAdminDashboard from "../../features/administration/pages/SystemAdminDashboard.jsx";
import TeacherManagement from "../../features/administration/pages/TeacherManagement.jsx";
import PremiumManagement from "../../features/administration/pages/PremiumManagement.jsx";
import StudentsList from "../../features/administration/pages/StudentsList.jsx";
import StudentDetails from "../../features/administration/pages/StudentDetails.jsx";
import CreateTest from "../../features/administration/pages/CreateTest.jsx";
import AssignedTests from "../../features/administration/pages/AssignedTests.jsx";
import CompanyManagement from "../../features/administration/pages/CompanyManagement.jsx";
import CodingQuestionManagement from "../../features/administration/pages/CodingQuestionManagement.jsx";
import AptitudeManagement from "../../features/administration/pages/AptitudeManagement.jsx";
import AuditLogs from "../../features/administration/pages/AuditLogs.jsx";
import SystemConfig from "../../features/administration/pages/SystemConfig.jsx";

import AptitudeRound from "../../features/testEngine/pages/AptitudeRound.jsx";
import AptitudeHub from "../../features/testEngine/pages/AptitudeHub.jsx";
import AptitudeAssessment from "../../features/testEngine/pages/AptitudeAssessment.jsx";
import CodingRound from "../../features/codingAssessment/pages/CodingRound.jsx";
import AptitudeHistory from "../../features/testEngine/pages/AptitudeHistory.jsx";
import CodingHistory from "../../features/codingAssessment/pages/CodingHistory.jsx";
import Bookmarks from "../../features/student/pages/Bookmarks.jsx";
import AvailableTests from "../../features/testEngine/pages/AvailableTests.jsx";
import TestEngine from "../../features/testEngine/pages/TestEngine.jsx";
import TestResult from "../../features/testEngine/pages/TestResult.jsx";
import PlacementDashboard from "../../features/placement/pages/PlacementDashboard.jsx";
import Leaderboard from "../../features/placement/pages/Leaderboard.jsx";
import MockOA from "../../features/placement/pages/MockOA.jsx";
import MockInterview from "../../features/companyMock/pages/MockInterview.jsx";
import CompanyMockInterview from "../../features/companyMock/pages/CompanyMockInterview.jsx";
import CompanyMockResult from "../../features/companyMock/pages/CompanyMockResult.jsx";
import CompanyMockHistory from "../../features/companyMock/pages/CompanyMockHistory.jsx";
import CompanyAnalytics from "../../features/companyMock/pages/CompanyAnalytics.jsx";
import PerformanceGraphs from "../../features/placement/pages/PerformanceGraphs.jsx";
import QuestionAnalytics from "../../features/placement/pages/QuestionAnalytics.jsx";
import Achievements from "../../features/student/pages/Achievements.jsx";
import AdminPlacementAnalytics from "../../features/administration/pages/PlacementAnalytics.jsx";
import AdminTechnicalManagement from "../../features/administration/pages/AdminTechnicalManagement.jsx";
import AnalyticsDashboard from "../../features/administration/pages/AnalyticsDashboard.jsx";
import MockQuestionManagement from "../../features/administration/pages/MockQuestionManagement.jsx";

import IndividualTechnicalPractice from "../../features/individualPractice/technical/pages/IndividualTechnicalPractice.jsx";
import IndividualTechnicalResult from "../../features/individualPractice/technical/pages/IndividualTechnicalResult.jsx";
import IndividualProjectPractice from "../../features/individualPractice/project/pages/IndividualProjectPractice.jsx";
import IndividualProjectResult from "../../features/individualPractice/project/pages/IndividualProjectResult.jsx";
import CodingRoundSelect from "../../features/codingAssessment/pages/CodingRoundSelect.jsx";

import CodingAssessment from "../../features/codingAssessment/pages/CodingAssessment.jsx";
import CodingAssessmentList from "../../features/codingAssessment/pages/CodingAssessmentList.jsx";
import CodingResult from "../../features/codingAssessment/pages/CodingResult.jsx";
import CodingAssessmentHistory from "../../features/codingAssessment/pages/CodingAssessmentHistory.jsx";

import AdminCodingAssessments from "../../features/administration/pages/AdminCodingAssessments.jsx";
import AdminCodingResults from "../../features/administration/pages/AdminCodingResults.jsx";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/registration-success" element={<RegistrationSuccess />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />

      {/* Dedicated Real AI Interview Control Room (Standalone without website navbar) */}
      <Route path="/interview" element={<StartInterview />} />
      <Route path="/interview/:sessionId" element={<StartInterview />} />

      {/* Standalone Real Interview Result Report — No Sidebar */}
      <Route path="/interview-history/:interviewId/result" element={<Results />} />
      <Route path="/real-interview/result/:sessionId" element={<Results />} />
      <Route path="/results" element={<Results />} />

      {/* Standalone Individual Technical Practice & Result — No Sidebar */}
      <Route path="/individual-practice/technical/:sessionId" element={<IndividualTechnicalPractice />} />
      <Route path="/individual-practice/technical/result/:sessionId" element={<IndividualTechnicalResult />} />

      {/* Standalone Individual Project / Resume Practice & Result — No Sidebar */}
      <Route path="/student/individual-project/practice/:sessionId" element={<IndividualProjectPractice />} />
      <Route path="/student/individual-project/result/:sessionId" element={<IndividualProjectResult />} />

      {/* Dedicated Company Mock Interview Control Room — standalone, renders ONLY
          the assessment with no website Navbar/Footer/Layout. */}
      <Route path="/company-mock" element={<CompanyMockInterview />} />
      <Route path="/company-mock/result/:attemptId" element={<CompanyMockResult />} />

      {/* Dedicated Coding Assessment IDE Control Room (Standalone without website navbar) */}
      <Route path="/coding-assessment/:assessmentId" element={<CodingAssessment />} />

      {/* Dedicated Coding Round IDE Workspace (Full-Screen Standalone without website navbar/sidebar) */}
      <Route path="/coding-round/test" element={<CodingRound />} />
      <Route path="/coding-round/test/:difficulty" element={<CodingRound />} />
      <Route path="/interview-practice/:companyId/coding" element={<CodingRound />} />

      {/* Dedicated Proctored Assessment Control Room (Fullscreen Standalone without website navbar/sidebar) */}
      <Route path="/tests/attempt/:attemptId" element={<TestEngine />} />

      <Route element={<StudentLayout />}>
        <Route path="/dashboard" element={<StudentDashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/interview-practice" element={<InterviewPractice />} />
        <Route path="/interview-practice/:companyId" element={<RoundSelection />} />
        <Route path="/interview-practice/:companyId/aptitude" element={<AptitudeRound />} />
        <Route path="/aptitude" element={<AptitudeHub />} />
        <Route path="/aptitude-round" element={<AptitudeHub />} />
        <Route path="/aptitude/practice" element={<AptitudeRound />} />
        <Route path="/aptitude/assessment" element={<AptitudeAssessment />} />
        <Route path="/aptitude/history" element={<AptitudeHistory />} />
        <Route path="/practice/aptitude/history" element={<AptitudeHistory />} />
        <Route path="/practice/coding/history" element={<CodingHistory />} />
        <Route path="/practice/bookmarks" element={<Bookmarks />} />
        <Route path="/tests" element={<AvailableTests />} />
        <Route path="/tests/result/:attemptId" element={<TestResult />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/interview-history" element={<InterviewHistory />} />
        <Route path="/placement-dashboard" element={<PlacementDashboard />} />
        <Route path="/placement/leaderboard" element={<Leaderboard />} />
        <Route path="/placement/mock-oa" element={<MockOA />} />
        <Route path="/mock-interview" element={<MockInterview />} />
        <Route path="/mock-interview/history" element={<CompanyMockHistory />} />
        <Route path="/coding-round" element={<CodingRoundSelect />} />
        <Route path="/coding-assessments" element={<CodingAssessmentList />} />
        <Route path="/coding-assessment/result/:attemptId" element={<CodingResult />} />
        <Route path="/coding-assessment/history" element={<CodingAssessmentHistory />} />
        <Route path="/placement/company-analytics" element={<CompanyAnalytics />} />
        <Route path="/placement/performance" element={<PerformanceGraphs />} />
        <Route path="/placement/question-analytics" element={<QuestionAnalytics />} />
        <Route path="/placement/achievements" element={<Achievements />} />
      </Route>

      <Route element={<AdminLayout />}>
        <Route path="/admin/system-dashboard" element={<SystemAdminDashboard />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/teachers" element={<TeacherManagement />} />
        <Route path="/admin/premium" element={<PremiumManagement />} />
        <Route path="/admin/students" element={<StudentsList />} />
        <Route path="/admin/students/:id" element={<StudentDetails />} />
        <Route path="/admin/analytics" element={<AnalyticsDashboard />} />
        <Route path="/admin/tests/create" element={<CreateTest />} />
        <Route path="/admin/tests/assigned" element={<AssignedTests />} />
        <Route path="/admin/companies" element={<CompanyManagement />} />
        <Route path="/admin/mock-questions" element={<MockQuestionManagement />} />
        <Route path="/admin/coding-questions" element={<CodingQuestionManagement />} />
        <Route path="/admin/coding-assessments" element={<AdminCodingAssessments />} />
        <Route path="/admin/coding-assessments/:id/results" element={<AdminCodingResults />} />
        <Route path="/admin/aptitude-questions" element={<AptitudeManagement />} />
        <Route path="/admin/audit-logs" element={<AuditLogs />} />
        <Route path="/admin/config" element={<SystemConfig />} />
        <Route path="/admin/placement-analytics" element={<AdminPlacementAnalytics />} />
        <Route path="/admin/technical-questions" element={<AdminTechnicalManagement />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
