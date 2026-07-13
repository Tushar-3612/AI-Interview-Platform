import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import AuthLayout from "../layouts/AuthLayout";
import Button from "../components/ui/Button";

/**
 * Registration Success Page — animated confirmation after signup.
 */
function RegistrationSuccess() {
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <div className="text-center py-4">
        {/* Animated Success Icon */}
        <div className="flex justify-center mb-6">
          <motion.div
            className="w-16 h-16 rounded-full flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: 0.1,
            }}
          >
            <CheckCircle2
              className="w-8 h-8 text-emerald-500"
              strokeWidth={2}
            />
          </motion.div>
        </div>

        {/* Success Message */}
        <h2
          className="text-lg font-bold mb-2 tracking-tight text-[var(--text-primary)]"
        >
          Registration Successful
        </h2>

        <p
          className="text-xs mb-8 leading-relaxed max-w-[280px] mx-auto text-[var(--text-secondary)]"
        >
          Your account has been created successfully.
          You can now log in and start preparing for your placements.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Button variant="gradient" onClick={() => navigate("/")} className="py-2.5">
            Continue to Login
          </Button>
        </motion.div>
      </div>
    </AuthLayout>
  );
}

export default RegistrationSuccess;
