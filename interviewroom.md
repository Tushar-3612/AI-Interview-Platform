# 🎙️ AI Interview Room — System Architecture, Logic, Bugs & Reference Guide

This document provides a comprehensive technical breakdown of the **AI Interview Room** system (`/interview` and `/interview/:sessionId`), detailing its architecture, execution flows, media engines, scoring mechanisms, edge cases, known bugs, and troubleshooting solutions.

---

## 📑 Table of Contents
1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Round-by-Round Flow & Logic](#2-round-by-round-flow--logic)
3. [Media, Voice & Proctoring Engine](#3-media-voice--proctoring-engine)
4. [Coding IDE & Execution Pipeline (Judge0)](#4-coding-ide--execution-pipeline-judge0)
5. [Evaluation, Scoring & Completion Logic](#5-evaluation-scoring--completion-logic)
6. [API Endpoints & Database Schemas](#6-api-endpoints--database-schemas)
7. [Identified Bugs, Edge Cases & Resolved Issues](#7-identified-bugs-edge-cases--resolved-issues)
8. [Debugging & Troubleshooting Playbook](#8-debugging--troubleshooting-playbook)

---

## 1. System Overview & Architecture

The **AI Interview Room** is a standalone, full-screen immersive assessment portal designed to simulate real-world technical and behavioral interviews.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI Interview Room UI                            │
│                                                                        │
│   ┌────────────────────────┐  ┌────────────────────────────────────┐   │
│   │   AI Interviewer Card  │  │        Active Question Card        │   │
│   │   • Animated Avatar    │  │ • Aptitude (MCQ / Timer)           │   │
│   │   • TTS Voice Engine   │  │ • Technical (Verbal / MCQ)         │   │
│   │   • Lip-Sync Visualizer│  │ • Coding (Monaco IDE + Judge0)     │   │
│   └────────────────────────┘  │ • HR (Behavioral STAR / Verbal)    │   │
│   ┌────────────────────────┐  └────────────────────────────────────┘   │
│   │   Proctored Candidate  │  ┌────────────────────────────────────┐   │
│   │   • Live Webcam Stream │  │   Response Input / STT Engine      │   │
│   │   • Audio Visualizer   │  │ • Speech-to-Text with Silence Buff │   │
│   │   • Fullscreen Monitor │  │ • Monaco Code Output & Test Cases  │   │
│   └────────────────────────┘  └────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                         REST API / JSON Payload
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Express Backend                               │
│                                                                        │
│  • interviewController.js         • interviewGenerationService.js       │
│  • codeExecutionController.js     • interviewCompletionService.js      │
│  • judge0Service.js (Sandboxed)   • aiEvaluationService.js             │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Frontend Files:
- **Main View Container**: [`frontend/src/pages/student/StartInterview.jsx`](file:///c:/Users/LOQ/OneDrive/Desktop/finalyearproject/AI-Interview-Platform/frontend/src/pages/student/StartInterview.jsx)
- **AI Interviewer Component**: [`frontend/src/components/interview/AIInterviewerCard.jsx`](file:///c:/Users/LOQ/OneDrive/Desktop/finalyearproject/AI-Interview-Platform/frontend/src/components/interview/AIInterviewerCard.jsx)
- **Webcam & Candidate Card**: [`frontend/src/components/interview/WebcamCard.jsx`](file:///c:/Users/LOQ/OneDrive/Desktop/finalyearproject/AI-Interview-Platform/frontend/src/components/interview/WebcamCard.jsx)
- **Question Card & MCQs**: [`frontend/src/components/interview/QuestionCard.jsx`](file:///c:/Users/LOQ/OneDrive/Desktop/finalyearproject/AI-Interview-Platform/frontend/src/components/interview/QuestionCard.jsx)
- **Monaco Code Editor**: [`frontend/src/components/coding/MonacoCodeEditor.jsx`](file:///c:/Users/LOQ/OneDrive/Desktop/finalyearproject/AI-Interview-Platform/frontend/src/components/coding/MonacoCodeEditor.jsx)
- **Testcase & Output Panel**: [`frontend/src/components/coding/OutputPanel.jsx`](file:///c:/Users/LOQ/OneDrive/Desktop/finalyearproject/AI-Interview-Platform/frontend/src/components/coding/OutputPanel.jsx)

---

## 2. Round-by-Round Flow & Logic

The interview platform supports both **Full-Spectrum Interviews** and **Targeted Single-Round Sessions**:

| Target Round | Duration | Question Mix | Primary Input Modality |
| :--- | :--- | :--- | :--- |
| **All (Full Session)** | 150 Mins | 25 Aptitude + 25 Tech + 3 Coding + 5 HR | Verbal, MCQ, Monaco Code Editor |
| **Aptitude** | 30 Mins | 25 Quantitative, Logical & Verbal MCQs | Click MCQ Option / Keyboard 1-4 |
| **Technical** | 45 Mins | 25 Tech Stack (Resume-tailored & DB MCQs/Verbal) | Speech-to-Text / Typed Verbal |
| **Coding** | 45 Mins | 3 Algorithmic / Data Structure Problems | Monaco IDE (C++, C, Java, Py, JS) |
| **HR Behavioral** | 15 Mins | 5 Situational / Behavioral Questions | Speech-to-Text / Audio Recording |

### Step-by-Step Execution Lifecycle:
1. **Bootstrapping**:
   - `StartInterview` retrieves the session via `GET /api/interview/:id`.
   - If not found or empty, it generates a fallback/initial question set tailored to the candidate's uploaded resume profile.
2. **Audio & Camera Initialization**:
   - Request `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`.
   - Setup Web Audio API `AudioContext` and `AnalyserNode` for dynamic waveform frequency bars.
3. **Turn-Taking State Machine**:
   - `SPEAKING`: AI interviewer synthesizes question speech via `useTextToSpeech`.
   - `LISTENING`: AI stops speaking, microphone turns on, `webkitSpeechRecognition` captures candidate voice.
   - `THINKING`: Transcripts finalized, answer submitted to backend, AI prepares next question.
   - `READY`: Question loaded and awaiting candidate action.
4. **Auto-Advance & Persistence**:
   - Each answer is saved to MongoDB via `POST /api/interview/:id/answer`.
   - State persists locally to prevent progress loss on page refresh.

---

## 3. Media, Voice & Proctoring Engine

### Text-to-Speech (TTS)
- Uses client-side **Web Speech API** (`window.speechSynthesis`) with intelligent voice selection (`selectOptimalVoice`).
- Fallback system defaults to backend synthesis if browser voices are muted or blocked.
- Supports customizable voice profiles (Natural Female, Natural Male, Professional UK, Studio US).

### Speech-to-Text (STT) & Silence Detection
- Employs continuous `webkitSpeechRecognition` / `SpeechRecognition`.
- **Adaptive Silence Buffer**:
  - Automatically captures intermittent speech chunks.
  - Detects conversational silence (> 2.5s pause after speaking) to auto-fill response text without truncating candidate thought process.
- **Manual Override**: Candidate can toggle between Voice Mode and Keyboard Typing Mode at any time.

### Integrity & Proctoring System
- **Fullscreen Enforcement**:
  - `document.documentElement.requestFullscreen()` triggered on entry.
  - `fullscreenchange` listener catches exits; triggers a non-dismissible warning overlay (`FullscreenExitOverlay`).
- **Tab-Switch & Blur Detection**:
  - Window `blur` and `visibilitychange` listeners increment warning count and log violation timestamps in session metrics.

---

## 4. Coding IDE & Execution Pipeline (Judge0)

For the **Coding Round**, candidates write, test, and submit algorithms in a fully sandboxed cloud execution environment powered by **Judge0 API**.

```
[Candidate Monaco Editor]
         │
         │  (language, sourceCode, stdin, testCases)
         ▼
[POST /api/code/run or /api/code/submit]
         │
         ▼
[Judge0 Remote Sandbox API]
 ├── Language IDs:
 │    • C++ (GCC 9.2.0) -> ID: 54
 │    • C (GCC 9.2.0)   -> ID: 50
 │    • Java (13.0.1)   -> ID: 62
 │    • Python (3.8.1)  -> ID: 71
 │    • JavaScript      -> ID: 63
 ├── Test Execution & Normalization (LF/CRLF strip, token comparison)
 └── JSON Response: { status, passed, total, score, execution_time, memory }
```

### Execution Features:
- **Run Custom Code**: Runs code with user-supplied STDIN input (`POST /api/code/run`).
- **Submit Solution**: Evaluates against hidden and visible test cases, calculates pass percentage, execution time in ms, and memory in KB (`POST /api/code/submit`).
- **Data Persistence**: Creates a `CodingSubmission` record linked to the user's interview session.

---

## 5. Evaluation, Scoring & Completion Logic

When the interview is completed (or ended early by user):
1. **Endpoint**: `POST /api/interview/:id/complete`
2. **Service**: Handled by [`backend/services/interviewCompletionService.js`](file:///c:/Users/LOQ/OneDrive/Desktop/finalyearproject/AI-Interview-Platform/backend/services/interviewCompletionService.js).
3. **Scoring Breakdown**:
   - **Aptitude**: Objective correctness ratio ($0-100\%$).
   - **Technical**: Semantic relevance + accuracy score from AI LLM evaluator.
   - **Coding**: Ratio of passed test cases $\times 100\%$.
   - **HR Behavioral**: Evaluated on STAR method (Situation, Task, Action, Result) clarity.
   - **Overall Score**:
     $$\text{Overall} = 0.20 \times \text{Aptitude} + 0.35 \times \text{Technical} + 0.30 \times \text{Coding} + 0.15 \times \text{HR}$$
4. **AI Qualitative Feedback**:
   - Generates strengths, improvement areas, study recommendations, and performance classification:
     - `High (>= 80%)`: "Ready for Placement"
     - `Medium (60-79%)`: "Minor Review Needed"
     - `Low (< 60%)`: "Needs Practice"
5. **Report & Dispatch**:
   - Persists final snapshot to `Result` collection.
   - Non-blocking email dispatch via `nodemailer` with rich HTML report card.

---

## 6. API Endpoints & Database Schemas

### Key API Routes:

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/interview/start` | Initialize new interview session | Yes |
| `GET` | `/api/interview/:id` | Fetch session details and question list | Yes |
| `POST` | `/api/interview/:id/answer` | Save candidate answer for question | Yes |
| `POST` | `/api/interview/:id/complete` | Grade interview, trigger AI evaluation | Yes |
| `GET` | `/api/interview/:id/result` | Fetch finalized grading report | Yes |
| `POST` | `/api/code/run` | Execute code with custom stdin | Yes |
| `POST` | `/api/code/submit` | Batch evaluate code against test cases | Yes |
| `GET` | `/api/code/languages` | Get supported compiler languages | No |
| `GET` | `/api/code/health` | Judge0 compiler health status | No |

---

## 7. Identified Bugs, Edge Cases & Resolved Issues

### 1. Merge Conflict Markers in Backend Controllers (Resolved)
- **Issue**: Git conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>>`) were left in `codeExecutionController.js`, `interviewController.js`, and `practiceController.js`.
- **Fix**: Removed all markers, standardized execution on `judge0Service.js`, and unified interview grading inside `interviewCompletionService.js`.

### 2. Double-Listener / Port 5000 `EADDRINUSE` (Resolved)
- **Issue**: Spawning `node server.js` while nodemon was running caused port conflict crashes.
- **Fix**: Verified port cleanup and single-daemon process management.

### 3. Response Schema Compatibility for Coding Submissions (Resolved)
- **Issue**: Frontend components were expecting both `passedCount`/`totalCount`/`results` and `passed`/`total`/`test_results`.
- **Fix**: Updated `submitCode` in `codeExecutionController.js` to return both formats simultaneously to guarantee zero frontend rendering breaks.

### 4. STT Auto-Cutoff on Long Pauses (Handled)
- **Issue**: Default browser speech recognition terminates after short silences.
- **Mitigation**: Added `silenceTimerRef` buffer that delays transcript finalization by 2500ms before triggering submission.

### 5. Audio Autoplay Policy Block (Handled)
- **Issue**: Chrome blocks TTS audio synthesis until the first user interaction.
- **Mitigation**: `StartInterview.jsx` listens for the first user click/interaction before triggering the AI greeting speech.

---

## 8. Debugging & Troubleshooting Playbook

### Checking Server & Services:
```bash
# Check if backend server is responsive
curl http://localhost:5000/api/health

# Check Judge0 code compiler status
curl http://localhost:5000/api/code/health

# Verify supported compiler languages
curl http://localhost:5000/api/code/languages
```

### Checking for Syntax or Conflict Errors:
```powershell
# Scan all backend files for syntax errors
Get-ChildItem -Path "backend", "server.js" -Recurse -Filter "*.js" | ForEach-Object { node -c $_.FullName }
```

### Rebuilding Frontend Assets:
```bash
cd frontend
npm run build
```
