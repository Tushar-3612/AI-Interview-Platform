import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  User,
  History,
  FileUp,
  Award,
  Flame,
  ChevronRight,
  TrendingUp,
  LogOut,
  Menu,
  X,
  Bell,
  Calendar,
  Briefcase,
  Code2,
  CheckCircle2,
  MessageSquare,
  Activity,
  ChevronDown,
  Sparkles,
  Plus,
  ArrowUpRight,
  Target,
  Brain,
  FileText,
  Sun,
  Moon
} from "lucide-react";
import { useTheme } from "../hooks/useTheme";

// ============================================================================
// Mock Data for the Student Dashboard
// ============================================================================
const studentProfile = {
  name: "Tushar",
  email: "tushar@college.edu",
  department: "Computer Science",
  year: "Final Year",
  avatarInitials: "TS",
  currentTier: "Gold Tier",
  streakDays: 7
};

const quotes = [
  "The secret of getting ahead is getting started. Let's practice another mock interview today!",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "Your talent determines what you can do. Your motivation determines how much you are willing to do.",
  "It always seems impossible until it's done. Focus on your goal, practice will make you perfect.",
  "Preparation is the key to success. The more you sweat in training, the less you bleed in battle."
];

const mockInterviews = [
  {
    id: "int-101",
    role: "Software Development Engineer (SDE) Intern",
    date: "July 14, 2026",
    score: 8.5,
    status: "Completed",
    categoryScores: {
      technical: 9.0,
      communication: 7.8,
      problemSolving: 9.2,
      confidence: 8.0
    },
    aiFeedback: "Strong DSA foundation, correct optimization. Communication was clear but had minor filler words ('like', 'uhm'). Overall highly competent."
  },
  {
    id: "int-102",
    role: "Frontend Engineer",
    date: "July 10, 2026",
    score: 7.2,
    status: "Completed",
    categoryScores: {
      technical: 7.0,
      communication: 8.2,
      problemSolving: 6.8,
      confidence: 7.0
    },
    aiFeedback: "Excellent JavaScript concept explanation. Needs practice in React rendering optimizations and system design. Good confidence levels."
  },
  {
    id: "int-103",
    role: "Backend Node.js Developer",
    date: "July 05, 2026",
    score: 9.0,
    status: "Completed",
    categoryScores: {
      technical: 9.4,
      communication: 8.5,
      problemSolving: 9.5,
      confidence: 8.6
    },
    aiFeedback: "Exceptional system architecture and database design answers. Solid error handling practices shown. Outstanding coding efficiency."
  },
  {
    id: "int-104",
    role: "Data Structures & Algorithms Mock #3",
    date: "June 28, 2026",
    score: 6.0,
    status: "Needs Practice",
    categoryScores: {
      technical: 5.5,
      communication: 6.8,
      problemSolving: 5.0,
      confidence: 6.7
    },
    aiFeedback: "Struggled with Dynamic Programming question. Suggested to review memoization strategies and time complexity calculations."
  }
];

const upcomingRecommendations = [
  {
    id: "rec-1",
    topic: "Improve DSA",
    detail: "Focus on Trees, Graphs & Dynamic Programming models.",
    icon: Code2,
    priority: "High",
    color: "var(--error)",
    bg: "rgba(239, 68, 68, 0.1)"
  },
  {
    id: "rec-2",
    topic: "Practice Communication",
    detail: "Work on pacing and reduce conversational filler words.",
    icon: MessageSquare,
    priority: "Medium",
    color: "var(--accent)",
    bg: "rgba(20, 184, 166, 0.1)"
  },
  {
    id: "rec-3",
    topic: "Solve Aptitude Questions",
    detail: "Practice Logical & Quantitative Reasoning modules.",
    icon: Target,
    priority: "Medium",
    color: "var(--primary)",
    bg: "rgba(37, 99, 235, 0.1)"
  },
  {
    id: "rec-4",
    topic: "HR Interview Practice",
    detail: "Revise behavioral answers using STAR methodology.",
    icon: User,
    priority: "Low",
    color: "var(--success)",
    bg: "rgba(16, 185, 129, 0.1)"
  }
];

const achievements = [
  {
    id: "ach-1",
    title: "DSA Ninja",
    desc: "Scored 9+ in Technical Round",
    tier: "Gold",
    icon: "🥷"
  },
  {
    id: "ach-2",
    title: "Fluent Communicator",
    desc: "Scored 8+ in speech assessment",
    tier: "Silver",
    icon: "🗣️"
  },
  {
    id: "ach-3",
    title: "Consistent Builder",
    desc: "Completed 3 interviews in a week",
    tier: "Bronze",
    icon: "🧱"
  },
  {
    id: "ach-4",
    title: "Perfect Streak",
    desc: "Maintained a 7-day practice streak",
    tier: "Platinum",
    icon: "🔥"
  }
];

export default function StudentDashboard() {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [hoveredChartPoint, setHoveredChartPoint] = useState(null);
  const [expandedInterview, setExpandedInterview] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");

  // Cycle quotes periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const totalMockInterviews = mockInterviews.length;
  const averageScore = (
    mockInterviews.reduce((acc, curr) => acc + curr.score, 0) / totalMockInterviews
  ).toFixed(1);

  // Categories scores averages
  const categoriesAverages = {
    technical: 77,
    communication: 78,
    problemSolving: 76,
    confidence: 76
  };

  // Toggle dynamic notification count or display list
  const mockNotifications = [
    { text: "AI generated your resume insights report", time: "2 hrs ago", new: true },
    { text: "Your mock interview score improved by 18%!", time: "1 day ago", new: false },
    { text: "New Technical Round templates uploaded for SDE roles", time: "3 days ago", new: false }
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex text-[var(--text-primary)] transition-colors duration-300">
      
      {/* ================= SIDEBAR NAVIGATION ================= */}
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-[var(--bg-secondary)] border-r border-[var(--border)] h-screen sticky top-0 z-40">
        <div className="p-6 border-b border-[var(--border)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center shadow-lg shadow-blue-500/10">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-md font-bold leading-none tracking-tight">AI Interview</h1>
            <span className="text-[10px] text-[var(--text-secondary)] font-medium">STUDENT PORTAL</span>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 p-4 space-y-1">
          {[
            { name: "Dashboard", icon: LayoutDashboard, path: "#" },
            { name: "Mock Interviews", icon: Code2, badge: "Live" },
            { name: "Resume Analyzer", icon: FileUp },
            { name: "Interview History", icon: History },
            { name: "Detailed Reports", icon: Activity },
            { name: "Achievements", icon: Award }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  if (item.name === "Dashboard" || item.name === "Achievements") {
                    setActiveTab(item.name);
                  }
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-[var(--primary)] text-white shadow-md shadow-blue-500/15"
                    : "text-[var(--text-secondary)] hover:bg-[var(--border)]/30 hover:text-[var(--text-primary)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4.5 h-4.5 ${isActive ? "text-white" : ""}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] px-2 py-0.5 font-bold uppercase rounded-full bg-emerald-500/15 text-emerald-500">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer / User Profile */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-primary)]/40">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center shadow-inner">
              {studentProfile.avatarInitials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{studentProfile.name}</p>
              <p className="text-[11px] text-[var(--text-secondary)] truncate">{studentProfile.email}</p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = "/"}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-red-500 hover:border-red-500/20 hover:bg-red-500/5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Navigation Backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-black z-40"
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25 }}
            className="lg:hidden fixed left-0 top-0 bottom-0 w-[270px] bg-[var(--bg-secondary)] border-r border-[var(--border)] z-50 flex flex-col"
          >
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--primary)] flex items-center justify-center">
                  <Briefcase className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h1 className="text-md font-bold leading-none tracking-tight">AI Interview</h1>
                  <span className="text-[9px] text-[var(--text-secondary)] font-medium">STUDENT PORTAL</span>
                </div>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--border)] text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {[
                { name: "Dashboard", icon: LayoutDashboard, path: "#" },
                { name: "Mock Interviews", icon: Code2, badge: "Live" },
                { name: "Resume Analyzer", icon: FileUp },
                { name: "Interview History", icon: History },
                { name: "Detailed Reports", icon: Activity },
                { name: "Achievements", icon: Award }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.name;
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      setActiveTab(item.name);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--text-secondary)] hover:bg-[var(--border)]/30 hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4.5 h-4.5" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[9px] px-2 py-0.5 font-bold uppercase rounded-full bg-emerald-500/15 text-emerald-500">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-primary)]/40">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center">
                  {studentProfile.avatarInitials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate leading-tight">{studentProfile.name}</p>
                  <p className="text-[11px] text-[var(--text-secondary)] truncate">{studentProfile.email}</p>
                </div>
              </div>
              <button
                onClick={() => window.location.href = "/"}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-red-500 hover:border-red-500/20 hover:bg-red-500/5 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ================= MAIN CONTAINER ================= */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        
        {/* ================= TOP NAVBAR ================= */}
        <header className="h-[70px] bg-[var(--bg-secondary)] border-b border-[var(--border)] px-4 sm:px-6 md:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--border)]/40 text-[var(--text-primary)] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-widest leading-none">Portal</span>
              <h2 className="text-base font-bold text-[var(--text-primary)] leading-tight">{activeTab} Overview</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Calendar Date Indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/40 text-xs text-[var(--text-secondary)] font-medium">
              <Calendar className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>Wednesday, July 15, 2026</span>
            </div>

            {/* Inline Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--border)]/35 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center justify-center"
            >
              {theme === "dark" ? (
                <Sun className="w-4.5 h-4.5 text-amber-500 animate-pulse-glow" />
              ) : (
                <Moon className="w-4.5 h-4.5 text-blue-600" />
              )}
            </button>

            {/* Notification Dropdown Trigger */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--border)]/35 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all relative cursor-pointer"
              >
                <Bell className="w-4.5 h-4.5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.18 }}
                      className="absolute right-0 mt-2 w-[280px] bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-[var(--shadow-card)] p-3 z-50 overflow-hidden"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] mb-2">
                        <span className="text-xs font-bold">Notifications</span>
                        <span className="text-[10px] text-[var(--primary)] font-semibold cursor-pointer">Mark all read</span>
                      </div>
                      <div className="space-y-2 max-h-[220px] overflow-y-auto">
                        {mockNotifications.map((notif, index) => (
                          <div key={index} className="p-2 rounded-xl hover:bg-[var(--border)]/30 transition-all text-left">
                            <p className="text-[11px] leading-tight font-medium">{notif.text}</p>
                            <span className="text-[9px] text-[var(--text-secondary)] mt-1 block">{notif.time}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* ================= PAGE CONTAINER ================= */}
        <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto w-full">

          {/* ================= WELCOME BANNER SECTION ================= */}
          <section className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-[var(--shadow-lg)]">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-60 h-60 rounded-full bg-white/5 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-80 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="max-w-[620px]">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white border border-white/10 text-xs font-semibold mb-4 backdrop-blur-md">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse-glow" />
                  <span>AI Readiness Score: Excellent</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Welcome back, {studentProfile.name}! 👋</h2>
                <div className="mt-2 text-sm text-blue-100/90 leading-relaxed min-h-[40px] transition-all duration-500">
                  &ldquo;{quotes[quoteIndex]}&rdquo;
                </div>
              </div>
              <div className="shrink-0 flex flex-wrap gap-3">
                <button 
                  onClick={() => setActiveTab("Mock Interviews")}
                  className="px-5 py-2.5 rounded-xl bg-white text-blue-700 font-bold text-xs hover:bg-blue-50 shadow-sm transition-all duration-200 flex items-center gap-1.5 hover:scale-102 active:scale-98 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Start New Interview</span>
                </button>
                <button 
                  onClick={() => setActiveTab("Detailed Reports")}
                  className="px-5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-xs hover:bg-white/15 transition-all duration-200 flex items-center gap-1.5 hover:scale-102 active:scale-98 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>View Reports</span>
                </button>
              </div>
            </div>
          </section>

          {/* ================= STATS / PROGRESS GRID ================= */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
            
            {/* OVERALL PREPARATION - CIRCULAR PROGRESS */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] flex items-center justify-between hover:border-[var(--primary)]/30 transition-all duration-300 hover:shadow-[var(--shadow-md)]">
              <div className="space-y-2">
                <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider block">Preparation Progress</span>
                <span className="text-3xl font-extrabold tracking-tight">74%</span>
                <span className="text-[11px] text-emerald-500 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Ready for Placements
                </span>
              </div>
              <div className="relative w-18 h-18 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="36" cy="36" r="30" className="stroke-[var(--border)] fill-none" strokeWidth="6" />
                  <circle 
                    cx="36" 
                    cy="36" 
                    r="30" 
                    className="stroke-[var(--primary)] fill-none transition-all duration-1000 ease-out" 
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 30}
                    strokeDashoffset={(2 * Math.PI * 30) * (1 - 0.74)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-xs font-bold text-[var(--primary)]">74%</div>
              </div>
            </div>

            {/* MOCK INTERVIEWS COMPLETED */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] flex items-center justify-between hover:border-[var(--primary)]/30 transition-all duration-300 hover:shadow-[var(--shadow-md)]">
              <div className="space-y-2">
                <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider block">Mocks Completed</span>
                <span className="text-3xl font-extrabold tracking-tight">{totalMockInterviews}</span>
                <span className="text-[11px] text-[var(--text-secondary)] font-medium">Goal: 10 Mock Interviews</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-[var(--primary)] flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            {/* AVERAGE score */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] flex items-center justify-between hover:border-[var(--primary)]/30 transition-all duration-300 hover:shadow-[var(--shadow-md)]">
              <div className="space-y-2">
                <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider block">Average AI Score</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold tracking-tight">{averageScore}</span>
                  <span className="text-sm font-semibold text-[var(--text-secondary)]">/ 10</span>
                </div>
                <div className="w-24 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full" style={{ width: `${parseFloat(averageScore) * 10}%` }} />
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* CURRENT SKILL TIER */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] flex items-center justify-between hover:border-[var(--primary)]/30 transition-all duration-300 hover:shadow-[var(--shadow-md)]">
              <div className="space-y-2">
                <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-wider block">Skill Tier Level</span>
                <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-600">{studentProfile.currentTier}</span>
                <span className="text-[11px] text-[var(--text-secondary)] font-medium">Top 8% of College</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-inner">
                <Award className="w-6 h-6" />
              </div>
            </div>

          </section>

          {/* ================= PERFORMANCE ANALYTICS & RECOMMENDATIONS ================= */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* ANALYTICS CARD (2/3 width on desktop) */}
            <div className="xl:col-span-2 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-5 sm:p-6 shadow-[var(--shadow-sm)] relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">Performance Analytics</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Mock interview score trends over time</p>
                </div>
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] shrink-0 self-start sm:self-auto">
                  <button className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--card-bg)] shadow-[var(--shadow-sm)] border border-[var(--border)] cursor-pointer">Weekly</button>
                  <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer">Monthly</button>
                </div>
              </div>

              {/* DYNAMIC SVG CHART AREA */}
              <div className="relative h-[200px] w-full border-b border-[var(--border)] mt-4">
                <svg className="w-full h-full" viewBox="0 0 400 150" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0" y1="30" x2="400" y2="30" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4 4" />
                  <line x1="0" y1="75" x2="400" y2="75" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4 4" />
                  <line x1="0" y1="120" x2="400" y2="120" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4 4" />
                  
                  {/* Gradient definition under the chart line */}
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Gradient Area Path */}
                  <path 
                    d="M 20 150 L 20 60 L 140 15 L 260 42 L 380 22 L 380 150 Z" 
                    fill="url(#chartGrad)" 
                    className="transition-all duration-300"
                  />

                  {/* Connecting Line */}
                  <path 
                    d="M 20 60 L 140 15 L 260 42 L 380 22" 
                    fill="none" 
                    stroke="var(--primary)" 
                    strokeWidth="3.5" 
                    strokeLinecap="round"
                    className="transition-all duration-300"
                  />

                  {/* Interactive Points */}
                  {[
                    { cx: 20, cy: 60, val: 6.0, idx: 0, label: "Jun 28" },
                    { cx: 140, cy: 15, val: 9.0, idx: 1, label: "Jul 05" },
                    { cx: 260, cy: 42, val: 7.2, idx: 2, label: "Jul 10" },
                    { cx: 380, cy: 22, val: 8.5, idx: 3, label: "Jul 14" }
                  ].map((pt) => (
                    <circle 
                      key={pt.idx}
                      cx={pt.cx} 
                      cy={pt.cy} 
                      r={hoveredChartPoint?.idx === pt.idx ? "6" : "4.5"}
                      className="fill-[var(--bg-secondary)] stroke-[var(--primary)] cursor-pointer transition-all duration-200"
                      strokeWidth={hoveredChartPoint?.idx === pt.idx ? "4.5" : "3"}
                      onMouseEnter={() => setHoveredChartPoint(pt)}
                      onMouseLeave={() => setHoveredChartPoint(null)}
                    />
                  ))}
                </svg>

                {/* SVG Line Chart Tooltip */}
                <AnimatePresence>
                  {hoveredChartPoint && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute p-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg text-[10px] pointer-events-none font-bold"
                      style={{
                        left: `${(hoveredChartPoint.cx / 400) * 100}%`,
                        top: `${(hoveredChartPoint.cy / 150) * 100 - 30}%`,
                        transform: "translate(-50%, -100%)"
                      }}
                    >
                      <div className="text-[var(--text-secondary)] font-semibold">{hoveredChartPoint.label}</div>
                      <div className="text-[var(--primary)] text-xs mt-0.5">AI Score: {hoveredChartPoint.val}/10</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Chart labels */}
              <div className="flex justify-between items-center px-4 mt-2.5 text-[10px] font-bold text-[var(--text-secondary)]">
                <span>Jun 28 (M#3)</span>
                <span>Jul 05 (Backend)</span>
                <span>Jul 10 (Frontend)</span>
                <span>Jul 14 (SDE)</span>
              </div>

              {/* Performance category ratings breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-[var(--border)]">
                {[
                  { name: "Technical Skills", val: categoriesAverages.technical, color: "bg-blue-500", rawVal: "8.5" },
                  { name: "Communication Skills", val: categoriesAverages.communication, color: "bg-teal-500", rawVal: "8.2" },
                  { name: "Problem Solving", val: categoriesAverages.problemSolving, color: "bg-indigo-500", rawVal: "9.0" },
                  { name: "Confidence", val: categoriesAverages.confidence, color: "bg-amber-500", rawVal: "8.0" }
                ].map((cat) => (
                  <div key={cat.name} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-[var(--text-secondary)]">{cat.name}</span>
                      <span className="font-bold">{cat.rawVal}/10</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${cat.val}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={`h-full ${cat.color} rounded-full`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RECOMMENDATIONS & UPCOMING SUGGESTIONS */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-5 sm:p-6 shadow-[var(--shadow-sm)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">Upcoming Suggestions</h3>
                  <span className="text-[9px] px-2 py-0.5 bg-indigo-500/10 text-indigo-500 font-bold uppercase rounded">AI Engine</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mb-4">Targeted suggestions to improve placement chances</p>
                
                <div className="space-y-3">
                  {upcomingRecommendations.map((rec) => {
                    const RecIcon = rec.icon;
                    return (
                      <div 
                        key={rec.id} 
                        className="flex items-start gap-3 p-2.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-secondary)] hover:border-[var(--primary)]/20 transition-all duration-200 group"
                      >
                        <div 
                          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: rec.bg, color: rec.color }}
                        >
                          <RecIcon className="w-4.5 h-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <h4 className="text-xs font-bold truncate">{rec.topic}</h4>
                            <span 
                              className="text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded-full border"
                              style={{ color: rec.color, borderColor: `${rec.color}20`, backgroundColor: `${rec.color}08` }}
                            >
                              {rec.priority}
                            </span>
                          </div>
                          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-normal truncate group-hover:whitespace-normal transition-all duration-300">{rec.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={() => setActiveTab("Mock Interviews")}
                className="w-full mt-5 py-2.5 rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5 text-xs font-bold text-[var(--primary)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Launch Practicing Session</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

          {/* ================= RECENT ACTIVITY & ACHIEVEMENTS TIMELINE ================= */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* RECENT MOCK INTERVIEWS LIST (2/3 width) */}
            <div className="xl:col-span-2 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-5 sm:p-6 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">Mock Interview Activity</h3>
                  <p className="text-xs text-[var(--text-secondary)]">History and AI feedback details</p>
                </div>
                <button 
                  onClick={() => setActiveTab("Interview History")}
                  className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
                >
                  View All
                </button>
              </div>

              {/* Expandable Mock Interview Cards */}
              <div className="space-y-3">
                {mockInterviews.map((item) => {
                  const isExpanded = expandedInterview === item.id;
                  const isHigh = item.score >= 8;
                  const isMed = item.score >= 7 && item.score < 8;
                  const statusColor = isHigh 
                    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/10" 
                    : isMed 
                      ? "text-blue-500 bg-blue-500/10 border-blue-500/10"
                      : "text-red-500 bg-red-500/10 border-red-500/10";

                  return (
                    <div 
                      key={item.id}
                      className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--bg-primary)]/20 hover:bg-[var(--bg-secondary)] transition-all duration-200"
                    >
                      <div 
                        onClick={() => setExpandedInterview(isExpanded ? null : item.id)}
                        className="p-4 flex items-center justify-between gap-4 cursor-pointer select-none"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">{item.role}</h4>
                          <span className="text-[10px] text-[var(--text-secondary)] block mt-0.5">{item.date}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${statusColor}`}>
                            Score: {item.score}/10
                          </span>
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-[var(--text-secondary)]"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </motion.div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="overflow-hidden border-t border-[var(--border)] bg-[var(--card-bg)]"
                          >
                            <div className="p-4 space-y-4 text-xs">
                              {/* Detailed Breakdown stats */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[var(--bg-primary)]/50 p-3 rounded-xl border border-[var(--border)]">
                                {[
                                  { label: "Technical", val: item.categoryScores.technical },
                                  { label: "Communication", val: item.categoryScores.communication },
                                  { label: "Problem Solving", val: item.categoryScores.problemSolving },
                                  { label: "Confidence", val: item.categoryScores.confidence }
                                ].map((cat) => (
                                  <div key={cat.label} className="text-center">
                                    <span className="text-[9px] text-[var(--text-secondary)] font-semibold block uppercase">{cat.label}</span>
                                    <span className="text-xs font-extrabold text-[var(--text-primary)]">{cat.val}</span>
                                  </div>
                                ))}
                              </div>

                              {/* AI Feedback message */}
                              <div className="space-y-1">
                                <span className="text-[10px] text-[var(--primary)] font-bold uppercase tracking-wider block">AI Critical Evaluation:</span>
                                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed italic">&ldquo;{item.aiFeedback}&rdquo;</p>
                              </div>

                              {/* Action to detailed evaluation */}
                              <div className="flex justify-end pt-1">
                                <button className="px-3.5 py-1.5 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/15 text-[10px] font-bold transition-all cursor-pointer">
                                  View Full AI Assessment
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STREAK & ACHIEVEMENTS */}
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-5 sm:p-6 shadow-[var(--shadow-sm)] space-y-5">
              
              {/* STREAK COUNTER */}
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 text-white relative overflow-hidden shadow-md">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 rounded-full bg-white/5 blur-xl pointer-events-none" />
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner">
                    🔥
                  </div>
                  <div>
                    <h4 className="text-xs font-bold leading-none uppercase text-orange-100 tracking-wider">Practice Streak</h4>
                    <p className="text-2xl font-extrabold mt-1">{studentProfile.streakDays} Consecutive Days</p>
                    <span className="text-[10px] text-orange-500 font-bold bg-white px-2 py-0.5 rounded-full mt-1.5 inline-block">Streak Active!</span>
                  </div>
                </div>
              </div>

              {/* ACHIEVEMENTS GRID */}
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Earned Milestones</h3>
                <div className="grid grid-cols-2 gap-3">
                  {achievements.map((badge) => (
                    <div 
                      key={badge.id} 
                      className="p-3 border border-[var(--border)] rounded-2xl bg-[var(--bg-primary)]/20 text-center hover:border-[var(--primary)]/20 transition-all group hover:bg-[var(--bg-secondary)]"
                    >
                      <span className="text-2xl block group-hover:scale-110 transition-transform duration-300">{badge.icon}</span>
                      <h4 className="text-xs font-bold mt-1 text-[var(--text-primary)] truncate">{badge.title}</h4>
                      <p className="text-[9px] text-[var(--text-secondary)] mt-0.5 leading-snug">{badge.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* LEADERSHIP LEADERBOARD MINI */}
              <div className="border border-[var(--border)] rounded-2xl p-3.5 bg-[var(--bg-primary)]/30">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Department Ranking</h4>
                  <span className="text-[10px] text-[var(--primary)] font-bold">#4 Rank</span>
                </div>
                <div className="space-y-1.5">
                  <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-500" style={{ width: "92%" }} />
                  </div>
                  <span className="text-[9px] text-[var(--text-secondary)]">You are ahead of 92% of students in CSE.</span>
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Footer info */}
        <footer className="py-6 border-t border-[var(--border)] bg-[var(--bg-secondary)] text-center text-xs text-[var(--text-secondary)] mt-auto">
          <p>&copy; 2026 AI Interview Platform. Designed for premium college placement training.</p>
        </footer>

      </main>
    </div>
  );
}
