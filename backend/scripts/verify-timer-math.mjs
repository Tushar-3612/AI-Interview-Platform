// Standalone verification of the server-authoritative timer algorithm
// (mirrors beginAttempt / pauseAttempt / resumeAttempt math).

function makeAttempt(durationMinutes) {
  return {
    status: "not_started",
    startedAt: null,
    expiresAt: null,
    pausedAt: null,
    totalPausedMs: 0,
    config: { durationMinutes },
  };
}

function computeRemainingMs(a, now) {
  if (!a.startedAt || !a.expiresAt) return 0;
  if (a.status === "paused" && a.pausedAt) {
    return Math.max(0, new Date(a.expiresAt).getTime() - new Date(a.pausedAt).getTime());
  }
  return Math.max(0, new Date(a.expiresAt).getTime() - now);
}

function begin(a, now) {
  if (a.status === "in_progress") return a;
  const durationMs = a.config.durationMinutes * 60000;
  a.status = "in_progress";
  if (!a.startedAt) a.startedAt = new Date(now);
  if (!a.expiresAt) a.expiresAt = new Date(now + durationMs);
  a.pausedAt = null;
  return a;
}

function pause(a, now) {
  if (a.status !== "in_progress") return a; // idempotent
  a.status = "paused";
  a.pausedAt = new Date(now);
  return a;
}

function resume(a, now) {
  if (a.status !== "paused") return a; // idempotent
  const pd = a.pausedAt ? now - new Date(a.pausedAt).getTime() : 0;
  a.totalPausedMs += pd;
  a.expiresAt = new Date(new Date(a.expiresAt).getTime() + pd);
  a.pausedAt = null;
  a.status = "in_progress";
  return a;
}

const MIN = 60000;
let t = 1000000; // arbitrary epoch base

// Scenario: 60 min test, answer some, exit fullscreen at 35:20 remaining,
// stay out 30 min, return.
const a = makeAttempt(60);
begin(a, t);
console.log("After begin: remaining =", Math.round(computeRemainingMs(a, t) / 1000), "s (expect 3600)");

// advance 24m40s -> remaining 35:20
t += 24 * MIN + 40 * 1000;
console.log("Before exit: remaining =", Math.round(computeRemainingMs(a, t) / 1000), "s (expect 2120)");

// exit fullscreen -> pause
pause(a, t);
const frozen = computeRemainingMs(a, t);
console.log("Paused frozen remaining =", Math.round(frozen / 1000), "s (expect 2120)");

// 30 minutes outside
t += 30 * MIN;
console.log("Still outside (30m later), timer =", Math.round(computeRemainingMs(a, t) / 1000), "s (expect 2120, NOT 320)");

// double pause must not add another period
pause(a, t + 1000);
console.log("After 2nd pause idempotent: status =", a.status, "pausedAt unchanged =", new Date(a.pausedAt).getTime() === t);

// return to fullscreen -> resume
resume(a, t);
console.log("After resume: remaining =", Math.round(computeRemainingMs(a, t) / 1000), "s (expect 2120)");
console.log("totalPausedMs =", a.totalPausedMs / 1000, "s (expect 1800)");
console.log("expiresAt shifted by 30m =", (new Date(a.expiresAt).getTime() - (t + 60 * MIN)) / 1000, "s offset (expect ~0 vs original deadline)");

// Now exhaust: advance 35:20 -> should expire only now
t += 35 * MIN + 20 * 1000;
const rem = computeRemainingMs(a, t);
console.log("After full active time used: remaining =", Math.round(rem / 1000), "s (expect 0 -> auto-submit)");

// Expiration only while running
console.log("\nALL TIMER ASSERTIONS DONE");
