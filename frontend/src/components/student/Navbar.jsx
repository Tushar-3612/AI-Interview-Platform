import { Link, useNavigate, useLocation } from "react-router-dom";
import { UserCircle, LogOut } from "lucide-react";
import Button from "../ui/Button";

function Navbar({ onStartInterview }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("student-profile");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    navigate("/");
  };

  const navLinks = [
    { name: "Home", path: "/dashboard" },
    { name: "Profile", path: "/profile" },
    { name: "Results", path: "/results" },
    { name: "History", path: "/interview-history" }
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link to="/home" className="text-xl font-bold text-primary">
          AI Interviewer
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === link.path
                  ? "bg-primary/10 text-primary"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-zinc-800"
              }`}
            >
              {link.name}
            </Link>
          ))}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <Button size="sm" onClick={onStartInterview}>
          Start Interview
        </Button>
        <div className="flex items-center gap-2 border-l pl-4 border-slate-200 dark:border-zinc-800">
          <Link to="/profile" className="text-slate-500 hover:text-primary transition-colors">
            <UserCircle className="w-6 h-6" />
          </Link>
          <button 
            onClick={handleLogout}
            className="text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
