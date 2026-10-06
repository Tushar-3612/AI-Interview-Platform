import React, { useState } from "react";
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
import ThemeToggle from "../ui/ThemeToggle.jsx";

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
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });

  const handlePointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      setPointerPos({
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      });
    } else {
      setPointerPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  return (
    <div
      className="min-h-screen lg:h-screen lg:max-h-screen w-full max-w-full overflow-x-hidden overflow-y-auto lg:overflow-hidden relative select-none bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300"
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <ThemeToggle />

      <div className="min-h-screen lg:h-full lg:max-h-screen w-full flex flex-col lg:flex-row overflow-x-hidden lg:overflow-hidden relative z-0">
        {/* ================= LEFT PANEL — 60% Visual Composition ================= */}
        <div className="hidden lg:flex lg:w-[58%] xl:w-[60%] h-full max-h-screen min-w-0 flex-col justify-between py-2 sm:py-3 lg:py-2.5 xl:py-3 2xl:py-6 px-4 sm:px-6 xl:px-8 2xl:px-10 border-r border-[var(--border)] overflow-hidden relative select-none bg-[var(--bg-primary)] transition-colors duration-300">
          {/* Subtle Dot Grid Pattern Top Right */}
          <div className="absolute top-3 right-6 xl:right-10 w-36 h-20 bg-dot-pattern opacity-60 pointer-events-none z-0" />

          {/* Ambient background hero glow */}
          <div className="hero-glow absolute inset-0 pointer-events-none z-0" />

          {/* ── 1. Top Header: Branding (Left) & Hand-Drawn Callout (Right) ── */}
          <header className="flex items-center justify-between w-full relative z-10 shrink-0 pb-0.5">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" aria-label="PrepHire" className="flex items-center focus:outline-none">
                <img
                  src="/images/metadata.png"
                  alt="PrepHire Logo"
                  className="h-10 sm:h-11 lg:h-11 xl:h-12 2xl:h-18 w-auto object-contain drop-shadow-sm transition-transform duration-200 hover:scale-[1.02]"
                  draggable="false"
                />
              </Link>
            </div>

            {/* Top Right Callout: Starts Here Hand-drawn */}
            <div className="flex flex-col items-end text-right pr-2 xl:pr-4 select-none">
              <span className="font-bold text-[8.5px] lg:text-[9px] xl:text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
                Your Placement Journey
              </span>
              <div
                className="flex items-center gap-1 text-[var(--primary)] text-base lg:text-lg xl:text-xl font-bold -mt-0.5"
                style={{ fontFamily: "'Caveat', cursive" }}
              >
                <span>Starts Here</span>
                <ArrowUpRight className="w-3.5 h-3.5 xl:w-4 xl:h-4 stroke-[2.5]" />
              </div>
            </div>
          </header>

          {/* ── 2. Middle Section: Hero Copy & 2x2 Feature Cards ── */}
          <main className="w-full my-auto py-1 xl:py-1.5 relative z-10">
            <div className="flex flex-col space-y-1.5 xl:space-y-2 max-w-2xl">
              {/* Hero Headline */}
              <div className="space-y-0.5 xl:space-y-1">
                <h1 className="text-xl sm:text-2xl lg:text-2xl xl:text-[28px] 2xl:text-[38px] font-extrabold text-[var(--text-primary)] tracking-tight leading-[1.12]">
                  Turn Your <br />
                  Preparation Into <br />
                  <span className="text-[var(--primary)] curved-underline">Real Opportunities</span>
                </h1>
              </div>

              {/* 2x2 Feature Grid */}
              <div className="grid grid-cols-2 gap-1.5 xl:gap-2 max-w-xl pt-0.5">
                {/* Feature 1: Mock Interviews */}
                <div className="bg-[var(--card-bg)] rounded-xl xl:rounded-2xl p-1.5 lg:p-1.5 xl:p-2 border border-[var(--border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 flex items-center gap-2">
                  <div className="w-6.5 h-6.5 xl:w-7.5 xl:h-7.5 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[var(--primary)] shrink-0">
                    <FileText className="w-3 h-3 xl:w-3.5 xl:h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-[var(--text-primary)] text-[10.5px] xl:text-[11.5px] truncate">
                      Mock Interviews
                    </h2>
                    <p className="text-[8px] xl:text-[9.5px] text-[var(--text-secondary)] font-normal leading-tight truncate">
                      Practice real-world questions
                    </p>
                  </div>
                </div>

                {/* Feature 2: AI Feedback */}
                <div className="bg-[var(--card-bg)] rounded-xl xl:rounded-2xl p-1.5 lg:p-1.5 xl:p-2 border border-[var(--border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 flex items-center gap-2">
                  <div className="w-6.5 h-6.5 xl:w-7.5 xl:h-7.5 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[var(--primary)] shrink-0">
                    <Zap className="w-3 h-3 xl:w-3.5 xl:h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-[var(--text-primary)] text-[10.5px] xl:text-[11.5px] truncate">
                      AI Feedback
                    </h2>
                    <p className="text-[8px] xl:text-[9.5px] text-[var(--text-secondary)] font-normal leading-tight truncate">
                      Get detailed performance analysis
                    </p>
                  </div>
                </div>

                {/* Feature 3: Track Progress */}
                <div className="bg-[var(--card-bg)] rounded-xl xl:rounded-2xl p-1.5 lg:p-1.5 xl:p-2 border border-[var(--border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 flex items-center gap-2">
                  <div className="w-6.5 h-6.5 xl:w-7.5 xl:h-7.5 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[var(--primary)] shrink-0">
                    <BarChart3 className="w-3 h-3 xl:w-3.5 xl:h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-[var(--text-primary)] text-[10.5px] xl:text-[11.5px] truncate">
                      Track Progress
                    </h2>
                    <p className="text-[8px] xl:text-[9.5px] text-[var(--text-secondary)] font-normal leading-tight truncate">
                      Monitor your improvement
                    </p>
                  </div>
                </div>

                {/* Feature 4: Placement Ready */}
                <div className="bg-[var(--card-bg)] rounded-xl xl:rounded-2xl p-1.5 lg:p-1.5 xl:p-2 border border-[var(--border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 flex items-center gap-2">
                  <div className="w-6.5 h-6.5 xl:w-7.5 xl:h-7.5 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[var(--primary)] shrink-0">
                    <Award className="w-3 h-3 xl:w-3.5 xl:h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-[var(--text-primary)] text-[10.5px] xl:text-[11.5px] truncate">
                      Placement Ready
                    </h2>
                    <p className="text-[8px] xl:text-[9.5px] text-[var(--text-secondary)] font-normal leading-tight truncate">
                      Be confident for your dream job
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* ── 3. Lower Bottom Section: Stats & Quote (Left 5-6 Cols) + Large Student Illustration (Right 6-7 Cols) ── */}
          <footer className="grid grid-cols-12 gap-2 xl:gap-3 items-end w-full pt-1 xl:pt-1.5 relative z-10 shrink-0">
            {/* Left Side Metrics & Motivational Quote */}
            <div className="col-span-6 xl:col-span-5 flex flex-col gap-1.5 xl:gap-2 pb-0.5">
              {/* Features Bar */}
              <div className="bg-[var(--card-bg)] rounded-xl xl:rounded-2xl p-1.5 xl:p-2 border border-[var(--border)] shadow-[var(--shadow-sm)] flex items-stretch justify-between text-center divide-x divide-[var(--border)] transition-colors duration-200">
                {/* 1. Resume Lab */}
                <div className="px-1 xl:px-1.5 flex-1 flex flex-col items-center justify-start text-center min-w-0">
                  <div className="w-4 h-4 xl:w-4.5 xl:h-4.5 mx-auto rounded-md xl:rounded-lg bg-orange-500/10 text-[var(--primary)] flex items-center justify-center text-xs mb-0.5 shrink-0">
                    <FileText className="w-2.5 h-2.5 xl:w-3 xl:h-3" />
                  </div>
                  <div className="text-[9px] xl:text-[9.5px] font-bold text-[var(--text-primary)] leading-tight mb-0.5 truncate w-full">
                    Resume Lab
                  </div>
                  <div className="text-[7px] xl:text-[8px] text-[var(--text-secondary)] font-medium leading-tight">
                    Build Better Resumes
                  </div>
                </div>

                {/* 2. AI Question Generator */}
                <div className="px-1 xl:px-1.5 flex-1 flex flex-col items-center justify-start text-center min-w-0">
                  <div className="w-4 h-4 xl:w-4.5 xl:h-4.5 mx-auto rounded-md xl:rounded-lg bg-orange-500/10 text-[var(--primary)] flex items-center justify-center text-xs mb-0.5 shrink-0">
                    <Sparkles className="w-2.5 h-2.5 xl:w-3 xl:h-3" />
                  </div>
                  <div className="text-[9px] xl:text-[9.5px] font-bold text-[var(--text-primary)] leading-tight mb-0.5">
                    AI Question Generator
                  </div>
                  <div className="text-[7px] xl:text-[8px] text-[var(--text-secondary)] font-medium leading-tight">
                    Smart Interview Questions
                  </div>
                </div>

                {/* 3. AI Evaluation */}
                <div className="px-1 xl:px-1.5 flex-1 flex flex-col items-center justify-start text-center min-w-0">
                  <div className="w-4 h-4 xl:w-4.5 xl:h-4.5 mx-auto rounded-md xl:rounded-lg bg-orange-500/10 text-[var(--primary)] flex items-center justify-center text-xs mb-0.5 shrink-0">
                    <LineChart className="w-2.5 h-2.5 xl:w-3 xl:h-3" />
                  </div>
                  <div className="text-[9px] xl:text-[9.5px] font-bold text-[var(--text-primary)] leading-tight mb-0.5 truncate w-full">
                    AI Evaluation
                  </div>
                  <div className="text-[7px] xl:text-[8px] text-[var(--text-secondary)] font-medium leading-tight">
                    Instant Performance Insights
                  </div>
                </div>
              </div>

              {/* Motivational Quote Card */}
              <div className="bg-[var(--card-bg)] rounded-xl xl:rounded-2xl p-1.5 xl:p-2 border border-[var(--border)] shadow-[var(--shadow-sm)] relative overflow-hidden transition-colors duration-200">
                <div className="text-[var(--primary)] text-lg xl:text-xl font-serif leading-none absolute top-1 left-1.5 opacity-25 select-none">
                  “
                </div>
                <p className="text-[8.5px] xl:text-[9.5px] font-semibold text-[var(--text-primary)] italic pl-3 pr-1 leading-snug">
                  &ldquo;Practice today, get placed tomorrow.&rdquo;
                </p>
                <div className="text-right text-[7.5px] xl:text-[9px] font-bold text-[var(--primary)] mt-0.5 pr-1">
                  — PrepHire
                </div>
              </div>
            </div>

            {/* Right Side Desk / Student Studio Composition Visual */}
            <div className="col-span-6 xl:col-span-7 relative flex items-end justify-center lg:justify-end">
              <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-orange-500/20 via-orange-400/10 to-transparent blur-xl pointer-events-none select-none opacity-70" />

              <div className="relative z-10 w-full max-w-[260px] sm:max-w-[340px] lg:max-w-[420px] xl:max-w-[500px] 2xl:max-w-[650px] flex justify-end items-end -mr-4 sm:-mr-6 lg:-mr-6 xl:-mr-8 2xl:-mr-10 -mb-2 sm:-mb-3 lg:-mb-2.5 xl:-mb-3 2xl:-mb-6">
                <div
                  className="relative w-full aspect-[3/2] overflow-hidden select-none"
                  style={{
                    maskImage:
                      "radial-gradient(ellipse 85% 90% at 50% 50%, black 40%, rgba(0,0,0,0.5) 70%, transparent 95%)",
                    WebkitMaskImage:
                      "radial-gradient(ellipse 85% 90% at 50% 50%, black 40%, rgba(0,0,0,0.5) 70%, transparent 95%)",
                  }}
                >
                  <img
                    src="/images/student1.png"
                    alt="PrepHire Student preparing for placement interview"
                    className="w-full h-full object-cover select-none pointer-events-none"
                    style={{ objectPosition: "46% 36%" }}
                    draggable="false"
                  />
                </div>
              </div>
            </div>
          </footer>
        </div>

        {/* ================= RIGHT PANEL — 40% Clean Auth Card (LOCKED) ================= */}
        <div 
          className="w-full lg:w-[42%] xl:w-[40%] min-h-screen lg:h-full lg:max-h-screen min-h-0 min-w-0 flex flex-col justify-start lg:justify-between items-center px-4 py-4 sm:px-6 sm:py-6 lg:px-5 lg:py-1.5 xl:px-8 xl:py-2 relative bg-[var(--bg-primary)] transition-colors duration-300 overflow-x-hidden overflow-y-auto lg:overflow-hidden"
          onMouseMove={handlePointerMove}
          onTouchMove={handlePointerMove}
        >
          {/* Reactive Glowing Background Orb */}
          <div
            className="absolute pointer-events-none transition-transform duration-75 ease-out opacity-100 dark:opacity-40 z-0 bg-[radial-gradient(circle,rgba(59,130,246,0.25)_0%,transparent_65%)] dark:bg-[radial-gradient(circle,rgba(255,107,53,0.25)_0%,transparent_65%)]"
            style={{
              width: 500,
              height: 500,
              transform: `translate(${pointerPos.x - 250}px, ${pointerPos.y - 250}px)`,
              left: 0,
              top: 0,
            }}
          />

          {/* Mobile Branding (only visible on mobile/tablet) */}
          <div className="flex lg:hidden flex-col items-center text-center mb-2.5 sm:mb-3 pt-1 shrink-0 z-10 relative">
            <Link to="/" aria-label="PrepHire" className="inline-flex items-center justify-center focus:outline-none">
              <img
                src="/images/metadata.png"
                alt="PrepHire Logo"
                className="h-8 sm:h-10 w-auto object-contain"
                draggable="false"
              />
            </Link>
          </div>

          {/* Centered Premium Auth Card */}
          <div className={`w-full ${contentClassName ? contentClassName : "max-w-[420px] xl:max-w-[440px]"} my-auto py-1 sm:py-2 lg:py-0 relative z-10 shrink-0`}>
            <div className={`bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl sm:rounded-3xl p-4 sm:p-5 lg:p-3.5 xl:p-4 2xl:p-6 shadow-[var(--shadow-card)] relative transition-colors duration-200 ${cardClassName}`}>
              {title && (
                <h2 className="text-lg sm:text-xl lg:text-lg xl:text-xl 2xl:text-2xl font-bold text-left mb-1 sm:mb-1.5 lg:mb-0.5 text-[var(--text-primary)] tracking-tight">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs sm:text-xs text-left mb-2.5 sm:mb-3 lg:mb-1 xl:mb-1.5 text-[var(--text-secondary)] leading-relaxed">
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
            <div className="hidden lg:flex items-center gap-2 xl:gap-2.5 self-end mt-auto pt-0.5 pr-2 select-none pointer-events-none opacity-80 z-0">
              <div
                className="w-14 h-7 opacity-35"
                style={{
                  backgroundImage: "radial-gradient(#FF6B35 1.8px, transparent 1.8px)",
                  backgroundSize: "11px 11px",
                }}
              />
              <div className="text-right -rotate-6 font-sans">
                <span className="block text-[9px] font-semibold italic text-[var(--text-secondary)] leading-tight">
                  Building Brighter Futures
                </span>
                <div className="relative inline-block font-bold text-[10.5px] text-[var(--text-primary)] leading-tight mt-0.5">
                  <span>Together</span>
                  <svg className="absolute -bottom-1 left-0 w-full h-1.5 text-[var(--primary)]" viewBox="0 0 55 7" fill="none">
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
