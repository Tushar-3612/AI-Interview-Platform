import { Toaster } from "react-hot-toast";
import AppRoutes from "./routes/AppRoutes";

function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          className: "toast-themed",
          style: {
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            fontSize: "14px",
            fontFamily: "Poppins, sans-serif",
            borderRadius: "12px",
            boxShadow: "var(--shadow-md)",
          },
          success: {
            iconTheme: { primary: "var(--success)", secondary: "#FFFFFF" },
          },
          error: {
            iconTheme: { primary: "var(--error)", secondary: "#FFFFFF" },
          },
        }}
      />

      <AppRoutes />
    </>
  );
}

export default App;
