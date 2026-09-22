import { Link } from "react-router-dom";
import {
  FileText,
  Zap,
  BarChart3,
  Award,
  Sparkles,
  LineChart,
  ArrowUpRight,
} from "lucide-react";
import ThemeToggle from "../components/ui/ThemeToggle";

/**
 * Split-screen auth layout — 60% Left Visual Presentation / 40% Right Auth Card (Locked).
 * Supports both Light and Dark modes seamlessly using CSS variables:
 * - Light Mode: warm off-white (#FAF8F5), white cards (#FFFFFF), dark navy text (#111827), blue-gray secondary (#6B7280)
 * - Dark Mode: deep dark background (#0F1117), sleek dark cards (#171A21), crisp white text (#F8F9FB), readable secondary (#94A3B8)
 * - PrepHire brand orange (#FF6B35) preserved across both themes
 */
function AuthLayout({
  children,
  title,
  subtitle,
  contentClassName = "",
  cardClassName = "",
  showFooterBadge = true,
}) {
  return (
    <div
      className="h-screen w-screen max-w-full overflow-hidden relative select-none bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300"
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <ThemeToggle />

      <div className="h-full w-full flex flex-col lg:flex-row overflow-hidden relative z-0">
        {/* ================= LEFT PANEL — 60% Visual Composition ================= */}
        <div className="hidden lg:flex lg:w-[60%] h-full min-w-0 flex-col justify-between py-4 xl:py-6 px-6 xl:px-10 border-r border-[var(--border)] overflow-hidden relative select-none bg-[var(--bg-primary)] transition-colors duration-300">
          {/* Subtle Dot Grid Pattern Top Right */}
          <div className="absolute top-4 right-6 xl:right-10 w-44 h-24 bg-dot-pattern opacity-60 pointer-events-none z-0" />

          {/* Ambient background hero glow */}
          <div className="hero-glow absolute inset-0 pointer-events-none z-0" />

          {/* ── 1. Top Header: Branding (Left) & Hand-Drawn Callout (Right) ── */}
          <header className="flex items-center justify-between w-full relative z-10 shrink-0 pb-1">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" aria-label="PrepHire" className="flex items-center focus:outline-none">
                <img
                  src="/images/metadata.png"
                  alt="PrepHire Logo"
                  className="h-20 xl:h-24 w-auto object-contain drop-shadow-sm transition-transform duration-200 hover:scale-[1.02]"
                  draggable="false"
                />
              </Link>
            </div>

            {/* Top Right Callout: Starts Here Hand-drawn */}
            <div className="flex flex-col items-end text-right pr-2 xl:pr-4 select-none">
              <span className="font-bold text-[10px] xl:text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">
                Your Placement Journey
              </span>
              <div
                className="flex items-center gap-1.5 text-[var(--primary)] text-xl xl:text-2xl font-bold -mt-0.5"
                style={{ fontFamily: "'Caveat', cursive" }}
              >
                <span>Starts Here</span>
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
              </div>
            </div>
          </header>

          {/* ── 2. Middle Section: Hero Copy & 2x2 Feature Cards ── */}
          <main className="w-full my-auto py-1 xl:py-2 relative z-10">
            <div className="flex flex-col space-y-3 xl:space-y-4 max-w-2xl">
              {/* Hero Headline */}
              <div className="space-y-1.5 xl:space-y-2">
                <h1 className="text-3xl lg:text-[34px] xl:text-[42px] 2xl:text-[48px] font-extrabold text-[var(--text-primary)] tracking-tight leading-[1.12]">
                  Turn Your <br />
                  Preparation Into <br />
                  <span className="text-[var(--primary)] curved-underline">Real Opportunities</span>
                </h1>
              </div>

              {/* 2x2 Feature Grid */}
              <div className="grid grid-cols-2 gap-2.5 xl:gap-3 max-w-xl pt-1">
                {/* Feature 1: Mock Interviews */}
                <div className="bg-[var(--card-bg)] rounded-2xl p-2.5 xl:p-3 border border-[var(--border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 flex items-center gap-3">
                  <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[var(--primary)] shrink-0">
                    <FileText className="w-4 h-4 xl:w-5 xl:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-[var(--text-primary)] text-xs xl:text-[13px] truncate">
                      Mock Interviews
                    </h2>
                    <p className="text-[10px] xl:text-[11px] text-[var(--text-secondary)] font-normal leading-tight truncate">
                      Practice real-world questions
                    </p>
                  </div>
                </div>

                {/* Feature 2: AI Feedback */}
                <div className="bg-[var(--card-bg)] rounded-2xl p-2.5 xl:p-3 border border-[var(--border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 flex items-center gap-3">
                  <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[var(--primary)] shrink-0">
                    <Zap className="w-4 h-4 xl:w-5 xl:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-[var(--text-primary)] text-xs xl:text-[13px] truncate">
                      AI Feedback
                    </h2>
                    <p className="text-[10px] xl:text-[11px] text-[var(--text-secondary)] font-normal leading-tight truncate">
                      Get detailed performance analysis
                    </p>
                  </div>
                </div>

                {/* Feature 3: Track Progress */}
                <div className="bg-[var(--card-bg)] rounded-2xl p-2.5 xl:p-3 border border-[var(--border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 flex items-center gap-3">
                  <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[var(--primary)] shrink-0">
                    <BarChart3 className="w-4 h-4 xl:w-5 xl:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-[var(--text-primary)] text-xs xl:text-[13px] truncate">
                      Track Progress
                    </h2>
                    <p className="text-[10px] xl:text-[11px] text-[var(--text-secondary)] font-normal leading-tight truncate">
                      Monitor your improvement
                    </p>
                  </div>
                </div>

                {/* Feature 4: Placement Ready */}
                <div className="bg-[var(--card-bg)] rounded-2xl p-2.5 xl:p-3 border border-[var(--border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 flex items-center gap-3">
                  <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[var(--primary)] shrink-0">
                    <Award className="w-4 h-4 xl:w-5 xl:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-[var(--text-primary)] text-xs xl:text-[13px] truncate">
                      Placement Ready
                    </h2>
                    <p className="text-[10px] xl:text-[11px] text-[var(--text-secondary)] font-normal leading-tight truncate">
                      Be confident for your dream job
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* ── 3. Lower Bottom Section: Stats & Quote (Left 5 Cols) + Large Student Illustration (Right 7 Cols) ── */}
          <footer className="grid grid-cols-12 gap-5 xl:gap-8 items-end w-full pt-3 xl:pt-4 relative z-10 shrink-0">
            {/* Left Side Metrics & Motivational Quote (5 cols) */}
            <div className="col-span-5 flex flex-col gap-2.5 xl:gap-3 pb-1">
              {/* Features Bar */}
              <div className="bg-[var(--card-bg)] rounded-2xl p-2.5 xl:p-3 border border-[var(--border)] shadow-[var(--shadow-sm)] flex items-stretch justify-between text-center divide-x divide-[var(--border)] transition-colors duration-200">
                {/* 1. Resume Lab */}
                <div className="px-1.5 xl:px-2 flex-1 flex flex-col items-center justify-start text-center min-w-0">
                  <div className="w-6 h-6 mx-auto rounded-lg bg-orange-500/10 text-[var(--primary)] flex items-center justify-center text-xs mb-1.5 shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-[11px] xl:text-xs font-bold text-[var(--text-primary)] leading-tight mb-1">
                    Resume Lab
                  </div>
                  <div className="text-[9px] xl:text-[9.5px] text-[var(--text-secondary)] font-medium leading-tight">
                    Build Better Resumes
                  </div>
                </div>

                {/* 2. AI Question Generator */}
                <div className="px-1.5 xl:px-2 flex-1 flex flex-col items-center justify-start text-center min-w-0">
                  <div className="w-6 h-6 mx-auto rounded-lg bg-orange-500/10 text-[var(--primary)] flex items-center justify-center text-xs mb-1.5 shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-[11px] xl:text-xs font-bold text-[var(--text-primary)] leading-tight mb-1">
                    AI Question Generator
                  </div>
                  <div className="text-[9px] xl:text-[9.5px] text-[var(--text-secondary)] font-medium leading-tight">
                    Smart Interview Questions
                  </div>
                </div>

                {/* 3. AI Evaluation */}
                <div className="px-1.5 xl:px-2 flex-1 flex flex-col items-center justify-start text-center min-w-0">
                  <div className="w-6 h-6 mx-auto rounded-lg bg-orange-500/10 text-[var(--primary)] flex items-center justify-center text-xs mb-1.5 shrink-0">
                    <LineChart className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-[11px] xl:text-xs font-bold text-[var(--text-primary)] leading-tight mb-1">
                    AI Evaluation
                  </div>
                  <div className="text-[9px] xl:text-[9.5px] text-[var(--text-secondary)] font-medium leading-tight">
                    Instant Performance Insights
                  </div>
                </div>
              </div>

              {/* Motivational Quote Card */}
              <div className="bg-[var(--card-bg)] rounded-2xl p-2.5 xl:p-3 border border-[var(--border)] shadow-[var(--shadow-sm)] relative overflow-hidden transition-colors duration-200">
                <div className="text-[var(--primary)] text-3xl font-serif leading-none absolute top-2 left-2.5 opacity-25 select-none">
                  “
                </div>
                <p className="text-[11px] xl:text-xs font-semibold text-[var(--text-primary)] italic pl-4 pr-1 leading-snug">
                  &ldquo;Practice today, get placed tomorrow.&rdquo;
                </p>
                <div className="text-right text-[10px] xl:text-[11px] font-bold text-[var(--primary)] mt-1 pr-1">
                  — PrepHire
                </div>
              </div>
            </div>

            {/* Right Side Desk / Student Studio Composition Visual (7 cols) */}
            <div className="col-span-7 relative flex items-end justify-center lg:justify-end">
              {/* Soft Ambient Halo behind illustration */}
              <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-orange-400/20 via-orange-200/20 to-transparent blur-2xl pointer-events-none select-none" />

              <div className="animate-natural-idle relative z-10 w-full max-w-[340px] xl:max-w-[420px] 2xl:max-w-[480px] flex justify-end items-end">
                <img
                  src="/images/student-learning.png"
                  alt="Student studying with laptop and books"
                  className="w-full h-auto max-h-[190px] xl:max-h-[235px] 2xl:max-h-[265px] object-contain drop-shadow-xl select-none"
                  draggable="false"
                />
              </div>
            </div>
          </footer>
        </div>

        {/* ================= RIGHT PANEL — 40% Clean Auth Card (LOCKED) ================= */}
        <div className="w-full lg:w-[40%] h-full min-h-0 min-w-0 flex flex-col items-center px-4 py-6 sm:px-6 sm:py-8 lg:px-6 lg:py-10 xl:px-8 xl:py-12 overflow-x-hidden overflow-y-auto relative bg-[var(--bg-primary)] transition-colors duration-300">
          {/* Mobile Branding (only visible on mobile/tablet) */}
          <div className="flex lg:hidden flex-col items-center text-center mb-4">
            <Link to="/" aria-label="PrepHire" className="inline-flex items-center justify-center focus:outline-none">
              <img
                src="/images/metadata.png"
                alt="PrepHire Logo"
                className="h-16 sm:h-20 w-auto object-contain"
                draggable="false"
              />
            </Link>
          </div>

          {/* Centered Premium Auth Card with z-10 & robust vertical scrolling */}
          <div className={`w-full ${contentClassName ? contentClassName : "max-w-[440px] xl:max-w-[455px]"} m-auto shrink-0 flex flex-col justify-center py-4 relative z-10`}>
            <div className={`bg-[var(--card-bg)] border border-[var(--border)] rounded-3xl p-7 sm:p-8 xl:p-9 shadow-[var(--shadow-card)] relative transition-colors duration-200 ${cardClassName}`}>
              {title && (
                <h2 className="text-2xl sm:text-[27px] font-bold text-left mb-1 text-[var(--text-primary)] tracking-tight">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs sm:text-[13px] text-left mb-4.5 text-[var(--text-secondary)] leading-relaxed">
                  {subtitle}
                </p>
              )}
              <div>
                {children}
              </div>
            </div>
          </div>

          {/* Bottom Right Decorative Elements: Dot Grid + "Building Brighter Futures Together" */}
          {showFooterBadge && (
            <div className="hidden lg:flex items-center gap-3 absolute bottom-4 right-8 select-none pointer-events-none opacity-80 z-0">
              <div
                className="w-20 h-10 opacity-35"
                style={{
                  backgroundImage: "radial-gradient(#FF6B35 1.8px, transparent 1.8px)",
                  backgroundSize: "13px 13px",
                }}
              />
              <div className="text-right -rotate-6 font-sans">
                <span className="block text-[10.5px] font-semibold italic text-[var(--text-secondary)] leading-tight">
                  Building Brighter Futures
                </span>
                <div className="relative inline-block font-bold text-xs text-[var(--text-primary)] leading-tight mt-0.5">
                  <span>Together</span>
                  <svg className="absolute -bottom-1.5 left-0 w-full h-2 text-[var(--primary)]" viewBox="0 0 55 7" fill="none">
                    <path d="M2 4.5C18 1.5 38 1.5 53 5.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
