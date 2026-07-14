import { Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import Signup from "../pages/Signup";
import RegistrationSuccess from "../pages/RegistrationSuccess";
import TermsAndConditions from "../pages/legal/TermsAndConditions";
import PrivacyPolicy from "../pages/legal/PrivacyPolicy";

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
    </Routes>
  );
}

export default AppRoutes;
