import {
  Briefcase,
  FileText,
  Laptop,
  TrendingUp,
  BarChart3,
  User,
  CheckCircle2,
  Award,
  Calendar,
  Layers,
  Zap,
  Sparkles,
  GitBranch,
  Code2,
  Cpu
} from "lucide-react";

// ============================================================================
// PremiumIllustration - Pure Static 2D Version (No Animations)
// ============================================================================
function PremiumIllustration() {
  return (
    <div className="relative w-full h-full max-w-[640px] max-h-[640px] aspect-square mx-auto flex items-center justify-center select-none overflow-visible">
      
      {/* 1. Center Monitor (Laptop Card) */}
      <div className="absolute z-10 w-[240px] sm:w-[280px]">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-[var(--shadow-lg)]">
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
              <span className="text-[8px] font-bold text-[var(--primary)] bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
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

      {/* 2. Resume Card - Top Left */}
      <div className="absolute top-[8%] left-[2%] z-20 w-[150px] sm:w-[170px]">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-[var(--shadow-md)]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6.5 h-6.5 rounded-full bg-[var(--border)] flex items-center justify-center text-[var(--primary)] shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold truncate text-[var(--text-primary)]">Resume Profile</div>
              <div className="text-[8px] text-[var(--text-secondary)]">College Standard</div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="h-1.5 bg-[var(--border)] rounded w-full" />
            <div className="h-1.5 bg-[var(--border)] rounded w-5/6" />
            
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-[7px] font-medium bg-[var(--border)] px-1.5 py-0.5 rounded text-[var(--text-primary)]">React</span>
              <span className="text-[7px] font-medium bg-[var(--border)] px-1.5 py-0.5 rounded text-[var(--text-primary)]">SQL</span>
              <span className="text-[7px] font-medium bg-[var(--border)] px-1.5 py-0.5 rounded text-[var(--text-primary)]">Node.js</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Analytics Card - Bottom Right */}
      <div className="absolute bottom-[4%] right-[3%] z-30 w-[180px] sm:w-[210px]">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span className="text-[9px] font-bold text-[var(--text-primary)]">Placement Analytics</span>
            </div>
            <BarChart3 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          </div>
          
          <div className="flex items-end gap-1.5 h-14 pt-2">
            {[45, 60, 52, 75, 68, 90].map((h, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className="w-full rounded-sm bg-gradient-to-t from-[var(--primary)] to-[var(--accent)] opacity-85"
                  style={{ height: `${h}%` }}
                />
                <span className="text-[6px] text-[var(--text-secondary)]">W{idx + 1}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-1 text-[7px] text-[var(--text-secondary)] text-center">
            📈 +12% vs last week
          </div>
        </div>
      </div>

      {/* 4. Documentation Card - Center Right */}
      <div className="absolute top-[48%] right-[-3%] z-20 w-[130px] sm:w-[155px]">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-2.5 shadow-[var(--shadow-md)] flex flex-col gap-1.5">
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

      {/* 5. Performance Report - Bottom Left */}
      <div className="absolute bottom-[6%] left-[4%] z-30 w-[160px] sm:w-[180px]">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3 shadow-[var(--shadow-lg)]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[9px] font-bold text-[var(--text-primary)]">Readiness Index</span>
            <Award className="w-3.5 h-3.5 text-[var(--accent)]" />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
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
              <span className="absolute text-[10px] font-bold text-[var(--text-primary)]">94%</span>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[var(--text-primary)]">Highly Ready</div>
              <div className="text-[8px] text-[var(--text-secondary)]">Mock aggregate score</div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Interview Status - Top Right */}
      <div className="absolute top-[5%] right-[2%] z-20 w-[170px] sm:w-[190px]">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-3.5 shadow-[var(--shadow-md)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-[var(--text-secondary)] font-medium flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[var(--primary)]" />
              Interview Completed
            </span>
            <span className="text-[8px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              VERIFIED
            </span>
          </div>
          <div>
            <div className="text-[10px] font-bold text-[var(--text-primary)]">Mock Interview #12</div>
            <div className="text-[8px] text-[var(--text-secondary)]">Technical Panel Assessment</div>
          </div>
          <div className="border-t border-[var(--border)] pt-2 flex items-center justify-between text-[8px] text-[var(--text-secondary)]">
            <span>Score: 92/100</span>
            <span className="font-semibold text-[var(--primary)]">Details →</span>
          </div>
        </div>
      </div>

      {/* 7. User Profile - Center Left */}
      <div className="absolute top-[42%] left-[-2%] z-20 w-[140px] sm:w-[160px]">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-2.5 shadow-[var(--shadow-md)] flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center shrink-0 text-white font-bold text-[10px]">
            AR
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-bold truncate text-[var(--text-primary)]">Alex Rivera</div>
            <div className="text-[7px] text-[var(--text-secondary)] truncate">CSE Senior</div>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-auto shrink-0" />
        </div>
      </div>

      {/* Static Particles - Just decorative dots */}
      <div className="absolute w-1 h-1 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '12%', left: '15%' }} />
      <div className="absolute w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '28%', left: '82%' }} />
      <div className="absolute w-0.5 h-0.5 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '62%', left: '8%' }} />
      <div className="absolute w-2 h-2 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '45%', left: '92%' }} />
      <div className="absolute w-1 h-1 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '78%', left: '38%' }} />
      <div className="absolute w-0.5 h-0.5 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '15%', left: '55%' }} />
      <div className="absolute w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '82%', left: '75%' }} />
      <div className="absolute w-1 h-1 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '50%', left: '10%' }} />
      <div className="absolute w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] opacity-15" style={{ top: '30%', left: '45%' }} />
    </div>
  );
}

export default PremiumIllustration;