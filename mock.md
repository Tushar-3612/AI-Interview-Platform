# Mock Interview — Full Report

This document explains how the **mock interview** feature works in the `ai-interview-engine` project. The codebase actually contains **three distinct "mock" flows**, so this report covers all of them and highlights which is the primary one.

---

## 1. Overview — The three "mock" concepts

| # | Feature | Backend | Frontend | AI-powered? | Status |
|---|---------|---------|----------|-------------|--------|
| A | **Company Mock Interview (dedicated)** | `backend/controllers/mockInterviewController.js` → `/api/mock-interview` | `frontend/src/pages/student/MockInterview.jsx` | No (DB questions) | Scoring is a **placeholder** (see §4) |
| B | **Company Interview Practice Rounds** | `backend/controllers/interviewController.js` (rounds) | `frontend/src/pages/student/InterviewPractice.jsx`, `RoundSelection.jsx`, `AptitudeRound.jsx`, `CodingRound.jsx` | Mixed (aptitude/technical from DB, coding run in Docker) | Functional |
| C | **Placement Mock OA** | `backend/controllers/placementController.js` → `/api/placement/mock-oa` | `frontend/src/pages/student/MockOA.jsx` | No (DB questions + Docker code exec) | Functional |
| D | **AI Voice Interview (type "mock")** | `backend/controllers/interviewController.js` | `frontend/src/pages/Interview.jsx` | Yes (LLM generates + evaluates) | Functional, but fixed to `interviewType: "actual"` at start |

The literal **"Mock Interview"** the product talks about is **Feature A** (dedicated company mock). The rest are related practice/assessment experiences.

---

## 2. Feature A — Dedicated Company Mock Interview (primary)

### 2.1 Entry point
- Route mount: `server.js:24,102` → `app.use("/api/mock-interview", mockInterviewRoutes)`
- Routes: `backend/routes/mockInterviewRoutes.js`
  - `POST /api/mock-interview/start` → `startMockInterview` (auth required)
  - `POST /api/mock-interview/submit` → `submitMockInterview` (auth required)

### 2.2 Start flow (`startMockInterview`, `mockInterviewController.js:9`)
1. Reads `companyId` from body + `userId` from JWT (`req.user.id`). Returns 400 if no company, 404 if company missing.
2. Defines a fixed config (lines 24–29):
   - `aptitudeCount: 15`, `technicalCount: 15`, `codingCount: 3`, `durationMinutes: 60`.
3. **Question de-duplication** via `QuestionExposure` model (`mockInterviewController.js:32-35`): fetches previously seen question IDs for this `(studentId, companyId)` so a student never gets the same question twice across attempts.
4. **Question selection** (no AI — pulled from DB collections):
   - `AptitudeQuestion.aggregate([{ $match: { _id: { $nin: seenAptitude } } }, { $sample: { size: 15 } }])` (`mockInterviewController.js:38`). Falls back to a random 15 if not enough unseen.
   - `TechnicalQuestion.aggregate([{ $match: { tags: company.name, _id: { $nin: seenTechnical } } }, { $sample: { size: 15 } }])` (line 47). Technical questions are **filtered by company name tag**; falls back to company-tagged only if not enough unseen.
   - `CodingQuestion.aggregate([{ $match: { _id: { $nin: seenCoding } } }, { $sample: { size: 3 } }])` (line 55).
5. Records new exposures in `QuestionExposure` (bulk insert, ignores duplicates) so future attempts avoid repeats.
6. Creates a `CompanyMockAttempt` document with `status: "in_progress"`, `startedAt`, and `expiresAt = now + 60 min`. Stores the selected question IDs in `selectedQuestions`.
7. Returns `attemptId`, `expiresAt`, and the full question objects (aptitude/technical/coding) to the client.

### 2.3 Data model (`backend/models/CompanyMockAttempt.js`)
A rich schema tracking:
- `userId`, `companyId`, `companyName`, `status` (`not_started | in_progress | paused | completed | auto_submitted | expired | abandoned`).
- **Server-authoritative timer**: `startedAt`, `expiresAt`, `pausedAt`, `totalPausedMs` (pausing shifts `expiresAt` forward so only active time counts — see schema comments lines 37–41).
- `config` (counts/duration), `currentSection`, `currentQuestionIndex`.
- `selectedQuestions` (aptitude/technical/coding ID arrays — used to resume).
- `aptitudeAnswers` (MCQ: `questionId`, `selectedOption`, `isCorrect`, `timeTakenMs`).
- `technicalAnswers` (MCQ: `questionId`, `answer`/`selectedOption`, `isCorrect`, `timeTakenMs`).
- `codingAnswers` (`questionId`, `language`, `code`, `status`, `passedCount`, `totalCount`, `score`, `results`, `timeTakenMs`).
- `scores` (per-section totals/correct/wrong/skipped/percentage/marks + `overall`).
- `securityEvents` + `security` counters (tab switches, fullscreen exits, copy/paste/cut/right-click) — anti-cheat logging.
- `codingDrafts` (per-language), `selectedCodingLanguage`, `feedback` (weak/strong areas, recommendation).

### 2.4 Frontend flow (`frontend/src/pages/student/MockInterview.jsx`)
- If no `attempt`, shows a company `<select>` (fetched from `/api/companies`) + "Begin Assessment" button (`handleStart`, line 51) → `POST /api/mock-interview/start`.
- Once started, the page renders **three sequential sections**: `aptitude → technical → coding` (sections hardcoded in `handleNext`/`handlePrev`, lines 79–106).
- Aptitude/technical render as **radio MCQs** (`question.options`); coding renders a plain `<textarea>` for code (line 241) — no Monaco editor, no execution in this feature.
- Answers stored in local React state `answers` keyed by section + questionId.
- On final coding question, "Submit Assessment" (`handleSubmit`, line 108) posts `{ attemptId, aptitudeAnswers, technicalAnswers, codingAnswers }` to `/api/mock-interview/submit`, then navigates to `/dashboard`.

### 2.5 Submit flow (`submitMockInterview`, `mockInterviewController.js:111`)
- Loads the attempt by `attemptId + userId` (404 if missing).
- Sets `status: "completed"`, `submittedAt`, and stores the raw answers.
- **Scoring is currently a stub** (see §4).

### 2.6 Dashboard integration
- `backend/controllers/dashboardStatsController.js` aggregates `CompanyMockAttempt` counts (`completed`/`in_progress`) into student dashboard stats (`mockInterviewsCompleted`, `mockInterviewsInProgress`, lines 78–99) and feeds the placement-readiness score (weighted 10%, line 178).
- `frontend/src/pages/StudentDashboard.jsx:173,674` shows the "Mock Interviews" card from real `CompanyMockAttempt` data.

---

## 3. Feature B — Company Interview Practice Rounds (related)

These are the more polished, per-company practice rounds reached from the navbar "Interview Practice" (`/interview-practice`):
- Routes: `AppRoutes.jsx:66-69` → `InterviewPractice`, `RoundSelection`, `AptitudeRound`, `CodingRound`.
- Flow: pick a company → `RoundSelection` shows Aptitude / Coding round cards → each round fetches its questions.
- Aptitude questions come from the DB; **coding questions are executed in a Docker sandbox** (see `backend/services` code-execution + `rateLimiter.js` which protects Docker for coding submits).
- Results pages: `InterviewResult.jsx`, history in `AptitudeHistory.jsx` / `CodingHistory.jsx`.

This is effectively the "practice" sibling of Feature A but with real coding execution and per-round navigation (unlike Feature A's single 3-section screen).

---

## 4. Feature C — Placement Mock OA (related)

- Routes: `backend/routes/placement.js:30-32` → `startMockOA`, `submitMockOA`, `getMockOAHistory`.
- Controller: `backend/controllers/placementController.js:136` (start), `:228` (submit), `:241` (history).
- Frontend: `frontend/src/pages/student/MockOA.jsx` (route `/placement/mock-oa`).
- A timed, company-specific OA that **runs coding problems in Docker** and stores results in `MockOAAttempt` (`backend/models/MockOAAttempt.js`). This is the "real exam experience" tied to the placement engine (`backend/services/placementEngine.js` uses `mockOAs` for scoring/insights).

---

## 5. Feature D — AI Voice Interview (type "mock")

- The LLM-driven interview lives in `backend/controllers/interviewController.js` and `frontend/src/pages/Interview.jsx` + `frontend/src/components/interview/*`.
- `startInterview` (line 122) supports `interviewType` (`actual` default; model enum also allows `mock`). It generates **25 technical + 5 HR + 3 coding via one AI call** plus **25 aptitude locally** (`interviewController.js:190,223`), persists into `InterviewQuestion`, and streams to the Interview Room.
- Per-answer evaluation is done by `evaluateSingleAnswer` / `evaluateCompleteInterview` (`backend/services/interviewGenerationService.js`) and finalized by `finalizeInterview` (`backend/services/interviewCompletionService.js`).
- Although the model supports `interviewType: "mock"`, the current `startInterview` hardcodes `interviewType: "actual"` (line 198). So today the AI interview always runs as "actual"; the "mock" label for AI interviews is not yet wired into the start path.
- `backend/controllers/studentController.js:234,688` treats `interviewType: "mock"` (and legacy `"practice"`) for filtering interview history.

---

## 6. Key findings / limitations

1. **Scoring is NOT implemented in the dedicated Mock Interview (Feature A).** `submitMockInterview` (`mockInterviewController.js:129-138`) sets `aptitudeScore = 0` and stores `marksObtained: 0` for every section; the detailed `scores` schema fields are never computed. Submitting returns `{ overall: 0 }`. The rich `CompanyMockAttempt.scores` schema is defined but unused on submit.
2. **No AI in Feature A** — questions are sampled from static DB collections (`AptitudeQuestion`, `TechnicalQuestion`, `CodingQuestion`), unlike the LLM-generated AI interview.
3. **Coding section in Feature A has no execution** — it's a plain textarea; code is stored but never compiled/run or scored (contrast with Features B/C which use Docker).
4. **`isCorrect` is never set** on aptitude/technical answers at submit time (the controller only stores `selectedOption`), so even correctness isn't evaluated server-side.
5. **Anti-cheat scaffolding exists** in the schema (`securityEvents`, tab-switch/fullscreen counters) but the `MockInterview.jsx` page does not yet emit those events (the `interview/*` components implement fullscreen/tab-switch overlays for the AI interview instead).
6. **`expiresAt` is sent to the client** but Feature A's frontend does not enforce the server timer (no auto-submit on expiry in the page; the schema supports `expired`/`auto_submitted` statuses but they're driven elsewhere).

---

## 7. End-to-end summary (Feature A)

```
Student opens /student mock interview
  → selects company → POST /api/mock-interview/start
      → backend dedupes via QuestionExposure, samples 15 A + 15 T + 3 C from DB
      → creates CompanyMockAttempt (in_progress, 60-min expiresAt)
      → returns questions
  → UI shows Aptitude → Technical → Coding MCQs + code textareas
  → POST /api/mock-interview/submit { attemptId, answers }
      → backend marks completed, stores answers
      → scoring = PLACEHOLDER (all 0)  ⚠️
  → navigate /dashboard
Dashboard + placement engine read CompanyMockAttempt counts for stats.
```

---

## 8. Relevant files

- `backend/controllers/mockInterviewController.js`
- `backend/routes/mockInterviewRoutes.js`
- `backend/models/CompanyMockAttempt.js`
- `backend/models/QuestionExposure.js`
- `backend/models/AptitudeQuestion.js`, `TechnicalQuestion.js`, `CodingQuestion.js`
- `backend/controllers/dashboardStatsController.js` (mock stats aggregation)
- `frontend/src/pages/student/MockInterview.jsx`
- `frontend/src/pages/StudentDashboard.jsx`
- Related: `backend/controllers/interviewController.js`, `backend/controllers/placementController.js`, `frontend/src/pages/student/InterviewPractice.jsx`, `MockOA.jsx`, `backend/services/interviewGenerationService.js`, `backend/services/interviewCompletionService.js`
