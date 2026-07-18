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

import RoundSelection from "../pages/student/RoundSelection";
import AptitudeRound from "../pages/student/AptitudeRound";
import CodingRound from "../pages/student/CodingRound";
import InterviewResult from "../pages/student/InterviewResult";

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

      {/* Student portal */}
      <Route element={<StudentLayout />}>
        <Route path="/dashboard" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/interview-practice" element={<InterviewPractice />} />
        <Route path="/interview-practice/:companyId" element={<RoundSelection />} />
        <Route path="/interview-practice/:companyId/aptitude" element={<AptitudeRound />} />
        <Route path="/interview-practice/:companyId/technical" element={<PracticeQuestion />} />
        <Route path="/interview-practice/:companyId/coding" element={<CodingRound />} />
        <Route path="/interview-practice/:companyId/result" element={<InterviewResult />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/interview-history" element={<InterviewHistory />} />
        <Route path="/results" element={<Results />} />
      </Route>
    </Routes>
  );
}


export default AppRoutes;
