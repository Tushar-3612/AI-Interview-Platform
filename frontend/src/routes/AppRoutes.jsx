import { Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import RegistrationSuccess from "../pages/RegistrationSuccess";
import TermsAndConditions from "../pages/legal/TermsAndConditions";
import PrivacyPolicy from "../pages/legal/PrivacyPolicy";
import StudentDashboard from "../pages/StudentDashboard";

/**
 * Application route definitions — auth module only.
 */
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/registration-success" element={<RegistrationSuccess />} />
      <Route path ="/terms-and-conditions" element ={<TermsAndConditions/>} />
      <Route path ="/privacy-policy" element ={<PrivacyPolicy/>} />
      <Route path="/dashboard" element={<StudentDashboard />} />
    </Routes>
  );
}

export default AppRoutes;
