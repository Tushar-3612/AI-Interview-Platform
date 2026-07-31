import { AlertTriangle, RefreshCw, ArrowLeft, AlertOctagon, ShieldAlert, WifiOff } from "lucide-react";

// Base Skeleton Component
export function Skeleton({ className = "", style }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

// 1. Skeleton Card
export function SkeletonCard() {
  return (
    <div className="student-card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
        <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-2/3 rounded-lg" />
        <Skeleton className="h-3.5 w-full rounded" />
        <Skeleton className="h-3.5 w-5/6 rounded" />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-5 w-20 rounded" />
        <Skeleton className="h-5 w-16 rounded" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4.5 w-14 rounded" />
          <Skeleton className="h-3.5 w-16 rounded" />
        </div>
        <Skeleton className="w-4 h-4 rounded-full" />
      </div>
    </div>
  );
}

// 2. Skeleton List (for Bookmarks page)
export function SkeletonList({ count = 3 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="student-card p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-5/6 rounded" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-xl" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

// 3. Company Card Skeleton
export function SkeletonCompanyCard() {
  return <SkeletonCard />;
}

// 4. Company Grid Skeleton
export function SkeletonCompanyGrid({ count = 8 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCompanyCard key={i} />
      ))}
    </div>
  );
}

// 5. Company Dashboard Skeleton
export function SkeletonCompanyDashboard() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      <Skeleton className="h-6 w-32 rounded-lg" />
      
      <div className="p-6 sm:p-8 student-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4 w-full">
          <Skeleton className="w-16 h-16 rounded-2xl shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-1/3 rounded-lg" />
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="h-3.5 w-1/4 rounded" />
          </div>
        </div>
      </div>

      <div className="student-card p-4 flex flex-wrap items-center gap-4">
        <Skeleton className="w-5 h-5 rounded-full" />
        <Skeleton className="h-4 w-3/4 rounded flex-1" />
        <Skeleton className="h-8 w-28 rounded-xl" />
      </div>

      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="student-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4 flex-1">
              <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-1/4 rounded-lg" />
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/3 rounded" />
              </div>
            </div>
            <Skeleton className="h-8 w-24 rounded-xl shrink-0 self-end sm:self-center" />
          </div>
        ))}
      </div>
    </div>
  );
}

// 6. Coding Round Skeleton
export function SkeletonCodingRound() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-4">
          <div className="student-card p-5 space-y-4">
            <Skeleton className="h-6 w-3/4 rounded-lg" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-5 w-20 rounded" />
            </div>
            <div className="space-y-2.5 pt-3">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-5/6 rounded" />
              <Skeleton className="h-4 w-2/3 rounded" />
            </div>
            <div className="pt-4 space-y-2">
              <Skeleton className="h-5 w-28 rounded-lg" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <div className="student-card p-4 space-y-4" style={{ background: "#0d0d0d", borderColor: "#222" }}>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "#222" }}>
              <Skeleton className="h-8 w-32 rounded-lg" style={{ background: "#1f2937" }} />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-16 rounded-lg" style={{ background: "#1f2937" }} />
                <Skeleton className="h-8 w-8 rounded-lg" style={{ background: "#1f2937" }} />
              </div>
            </div>
            
            <div className="space-y-2 py-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-3.5 rounded"
                  style={{
                    width: `${30 + ((i * 47) % 60)}%`,
                    background: "#1f2937",
                    marginLeft: `${(i % 3 === 1) ? 20 : (i % 3 === 2) ? 40 : 0}px`
                  }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "#222" }}>
              <Skeleton className="h-8 w-20 rounded-lg" style={{ background: "#1f2937" }} />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20 rounded-xl" style={{ background: "#1f2937" }} />
                <Skeleton className="h-9 w-24 rounded-xl" style={{ background: "#1f2937" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 7. Aptitude Quiz Skeleton
export function SkeletonAptitudeQuiz() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="student-card p-6 space-y-5">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-24 rounded" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-5 w-full rounded" />
            <Skeleton className="h-5 w-5/6 rounded" />
            
            <div className="space-y-3 pt-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3.5 border rounded-xl" style={{ borderColor: "var(--border)" }}>
                  <Skeleton className="w-5 h-5 rounded-full shrink-0" />
                  <Skeleton className="h-4 flex-1 rounded" />
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-5 border-t" style={{ borderColor: "var(--border)" }}>
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="student-card p-5 space-y-4">
            <Skeleton className="h-5 w-1/2 rounded" />
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 15 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
            <div className="pt-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
              <Skeleton className="h-8 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 8. Admin Table Skeleton
export function SkeletonAdminTable({ rows = 6, cols = 5 }) {
  return (
    <div className="border rounded-2xl overflow-hidden shadow-[var(--shadow-sm)]" style={{ borderColor: "var(--border)", background: "var(--card-bg)" }}>
      <div className="flex border-b p-4 bg-slate-50 dark:bg-zinc-900" style={{ borderColor: "var(--border)" }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1 rounded max-w-[150px] mr-4" />
        ))}
      </div>
      
      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex p-4 items-center">
            {Array.from({ length: cols }).map((_, j) => {
              if (j === cols - 1) {
                return (
                  <div key={j} className="flex gap-2 justify-end flex-1">
                    <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                    <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                  </div>
                );
              }
              return (
                <div key={j} className="flex-1 mr-4">
                  <Skeleton className={`h-4 rounded ${j === 0 ? "w-2/3" : "w-1/2"}`} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// 9. Student Dashboard Skeleton
export function SkeletonStudentDashboard() {
  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto w-full">
      <div className="rounded-3xl p-6 sm:p-8 space-y-4" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", border: "1px solid var(--border)" }}>
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-8 w-1/3 rounded-lg" />
        <Skeleton className="h-4 w-1/2 rounded" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 flex items-center justify-between">
            <div className="space-y-2 flex-1 mr-4">
              <Skeleton className="h-3.5 w-2/3 rounded" />
              <Skeleton className="h-7 w-12 rounded" />
              <Skeleton className="h-3 w-full rounded" />
            </div>
            <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((k) => (
          <div key={k} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <Skeleton className="h-5 w-40 rounded" />
                <Skeleton className="h-3.5 w-24 rounded" />
              </div>
              <Skeleton className="h-4 w-14 rounded" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-24 rounded" />
                      <Skeleton className="h-3 w-16 rounded" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-12 rounded shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 10. Stats & Charts Loader
export function SkeletonStats({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-5 space-y-3 shadow-[var(--shadow-sm)]">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-2.5 w-full rounded" />
        </div>
      ))}
    </div>
  );
}

// 11. Chart Skeleton
export function SkeletonChart() {
  return (
    <div className="space-y-3 p-4 student-card">
      <div className="flex items-end gap-2 h-40">
        {[45, 70, 55, 85, 60, 95, 50, 75, 65, 90, 40, 80].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="flex justify-between pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 w-10 rounded" />
        ))}
      </div>
    </div>
  );
}

// 12. Attempt History Skeleton
export function SkeletonAttemptHistory({ count = 4 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="student-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-28 rounded-lg" />
                <Skeleton className="h-5 w-16 rounded-lg" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-3.5 w-24 rounded" />
                <Skeleton className="h-3.5 w-16 rounded" />
              </div>
            </div>
            <div className="text-right space-y-1">
              <Skeleton className="h-6 w-12 rounded ml-auto" />
              <Skeleton className="h-3.5 w-24 rounded ml-auto" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 w-28 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

// 13. Error State Component
export function ErrorState({
  statusCode,
  message = "An unexpected error occurred while communicating with the server.",
  onRetry,
  onGoBack,
  compact = false
}) {
  let Icon = AlertTriangle;
  let title = "Could Not Load Data";
  let description = message;

  if (statusCode === 404) {
    Icon = AlertOctagon;
    title = "Resource Not Found (404)";
    description = message || "The page or item you are looking for does not exist or has been removed.";
  } else if (statusCode === 401 || statusCode === 403) {
    Icon = ShieldAlert;
    title = "Access Denied";
    description = message || "You do not have active credentials to access this section.";
  } else if (statusCode === 500) {
    Icon = AlertTriangle;
    title = "Internal Server Error (500)";
    description = message || "The server encountered an error. Please try again in a few moments.";
  } else if (statusCode === "network_failure" || !navigator.onLine) {
    Icon = WifiOff;
    title = "Connection Failure";
    description = "It seems you are offline or the platform API is currently unreachable. Please check your internet connection.";
  }

  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "p-6" : "p-12 md:p-16 student-card max-w-lg mx-auto my-8 bg-[var(--card-bg)]"}`}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(239, 68, 68, 0.08)" }}>
        <Icon className="w-8 h-8" style={{ color: "var(--error)" }} />
      </div>
      <h3 className="text-lg font-bold mb-2 text-[var(--text-primary)]">{title}</h3>
      <p className="text-sm mb-6 max-w-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
      
      <div className="flex items-center gap-3 justify-center">
        {onGoBack && (
          <button
            type="button"
            onClick={onGoBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition hover:bg-[var(--border)]/20 cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go Back
          </button>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4.5 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90 cursor-pointer shadow-sm btn-gradient"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Connection
          </button>
        )}
      </div>
    </div>
  );
}