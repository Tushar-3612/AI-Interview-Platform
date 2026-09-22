import {
  CheckCircle2,
  Award,
  Zap,
  GitBranch,
  Code2,
  Cpu
} from "lucide-react";

// ============================================================================
// PremiumIllustration - Pure Static 2D Version (No Animations)
// ============================================================================
function PremiumIllustration() {
  return (
    <div className="relative w-full max-w-[580px] xl:max-w-[620px] h-[360px] sm:h-[390px] xl:h-[420px] mx-auto flex items-center justify-center select-none">

      {/* 1. Center Monitor (Laptop Card) */}
      <div className="absolute z-10 w-[240px] sm:w-[260px]">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-lg)]">
          <div className="flex items-center gap-1.5 mb-2.5 border-b border-[var(--border)] pb-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-[9px] font-medium text-[var(--text-secondary)] ml-2 flex items-center gap-1">
              <Cpu className="w-3 h-3" />
              Compiler Session #481
            </span>
          </div>

          <div className="bg-[var(--input-bg)] rounded-lg p-2.5 flex flex-col gap-2 aspect-[16/10]">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-bold text-[var(--primary)] bg-orange-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Zap className="w-2.5 h-2.5" />
                TECHNICAL ROUND
              </span>
              <span className="text-[8px] text-[var(--text-secondary)] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Compiler
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-1 mt-1 font-mono text-[7px] text-[var(--text-secondary)]">
              <div className="h-1 bg-[var(--border)] rounded w-4/5" />
              <div className="h-1 bg-[var(--border)] rounded w-full" />
              <div className="flex gap-1 items-center mt-1">
                <Code2 className="w-3 h-3 text-[var(--primary)]" />
                <span className="text-[8px] text-[var(--text-primary)] font-semibold">Active workspace</span>
              </div>
              <div className="h-1 bg-[var(--border)] rounded w-5/6" />
              <div className="h-1 bg-[var(--border)] rounded w-2/3" />
            </div>

            <div className="flex items-center justify-between border-t border-[var(--border)] pt-1.5 mt-auto">
              <span className="text-[8px] text-[var(--text-secondary)] flex items-center gap-1">
                <GitBranch className="w-2.5 h-2.5" />
                Status: Verified
              </span>
              <span className="text-[8px] font-semibold text-emerald-500">92% Match</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Documentation Card - Center Right */}
      <div className="absolute top-[46%] right-[0%] z-20 w-[130px] sm:w-[145px]">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3 shadow-[var(--shadow-md)] flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[9px] font-bold text-[var(--text-primary)]">Documentation</span>
          </div>
          <div className="flex flex-col gap-1 text-[7px] text-[var(--text-secondary)]">
            <div className="flex justify-between">
              <span>Resume Verified</span>
              <span className="font-semibold text-emerald-500">✓</span>
            </div>
            <div className="flex justify-between">
              <span>Transcripts</span>
              <span className="font-semibold text-emerald-500">✓</span>
            </div>
            <div className="flex justify-between">
              <span>Portfolio</span>
              <span className="font-semibold text-emerald-500">✓</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Performance Report - Bottom Left */}
      <div className="absolute bottom-[2%] left-[4%] z-30 w-[155px] sm:w-[170px]">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-3 shadow-[var(--shadow-lg)]">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[9px] font-bold text-[var(--text-primary)]">Readiness Index</span>
            <Award className="w-3.5 h-3.5 text-[var(--accent)]" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[var(--border)]"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[var(--accent)]"
                  strokeDasharray="94, 100"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[9px] font-bold text-[var(--text-primary)]">94%</span>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[var(--text-primary)]">Highly Ready</div>
              <div className="text-[8px] text-[var(--text-secondary)]">Mock aggregate score</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. User Profile - Center Left */}
      <div className="absolute top-[44%] left-[0%] z-20 w-[135px] sm:w-[150px]">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-2.5 shadow-[var(--shadow-md)] flex items-center gap-2">
          <div className="w-6.5 h-6.5 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center shrink-0 text-white font-bold text-[9px]">
            AR
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-bold truncate text-[var(--text-primary)]">Alex Rivera</div>
            <div className="text-[7px] text-[var(--text-secondary)] truncate">CSE Senior</div>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-auto shrink-0" />
        </div>
      </div>

      {/* Decorative dots */}
      <div className="absolute w-1 h-1 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '12%', left: '15%' }} />
      <div className="absolute w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '28%', left: '82%' }} />
      <div className="absolute w-0.5 h-0.5 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '62%', left: '8%' }} />
      <div className="absolute w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '45%', left: '92%' }} />
      <div className="absolute w-1 h-1 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '78%', left: '38%' }} />
      <div className="absolute w-1 h-1 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '82%', left: '75%' }} />
    </div>
  );
}

export default PremiumIllustration;