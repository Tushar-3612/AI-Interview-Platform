# Completed Project Modules & Architecture — AI Interview Platform

## Executive Summary

The **AI-Powered Resume-Based Mock Interview and Candidate Evaluation Platform** is a full-stack SaaS-grade MERN (MongoDB, Express.js, React 19, Node.js) web application powered by **Google Gemini 2.5 Flash AI**. It offers college students personalized, resume-driven mock interviews, practice rounds, company-specific hiring simulations, and placement analytics, while equipping college administration with audit control, candidate management, automated test assignments, and multi-format reporting.

---

## 1. System Architecture & Technology Stack

```
                                  ┌──────────────────────────────┐
                                  │      React 19 Frontend       │
                                  │  (Vite + Tailwind 4 + TW)    │
                                  └──────────────┬───────────────┘
                                                 │ REST API (Axios + JWT)
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │       Node.js / Express 5    │
                                  │       Backend Application    │
                                  └──────┬───────┬───────┬───────┘
                                         │       │       │
                  ┌──────────────────────┘       │       └──────────────────────┐
                  ▼                              ▼                              ▼
      ┌───────────────────────┐      ┌───────────────────────┐      ┌───────────────────────┐
      │     MongoDB Atlas     │      │ Google Gemini 2.5 AI  │      │   CSV Sync & Exports  │
      │  (Primary Database)   │      │   (Resume / Evaluation)│      │    (Admin Backups)    │
      └───────────────────────┘      └───────────────────────┘      └───────────────────────┘
```

| Layer | Technologies & Libraries |
| :--- | :--- |
| **Frontend Framework** | React 19, Vite, React Router DOM v7 |
| **Styling & Animation** | Tailwind CSS 4, Framer Motion, Lucide React, Custom CSS Variables |
| **Backend Framework** | Node.js, Express.js 5 |
| **Database & ODM** | MongoDB Atlas, Mongoose 9 |
| **Security & Middleware** | JWT (JSON Web Tokens), bcryptjs, Helmet, Express-Mongo-Sanitize, CORS, API Rate Limiting |
| **AI Integration** | `@google/genai` (Google Gemini 2.5 Flash) |
| **File Processing & PDF** | Multer (In-memory buffer), PDFKit (PDF Generation), XLSX (Excel Export) |
| **Email Service** | Nodemailer (SMTP with HTML templates & attachments) |

---

## 2. Completed Modules Breakdown

### 2.1 Authentication & Security System
- **Dual-Role Access Control**: Strict segregation between `student` and `admin` roles via JWT payloads and route protection guards (`ProtectedRoute.jsx`, `authMiddleware.js`).
- **Student Registration & Login**: Full validation (Name, Email, Department, Year, Password), bcrypt password hashing, duplicate email detection, auto-syncing to CSV backup.
- **Admin Authentication**: Secure login mechanism for administrative operations.
- **Theme & UX System**: SaaS-grade split-screen interface with light/dark theme toggle, localStorage persistence, smooth Framer Motion micro-interactions, parallax 3D visual assets, and toast notifications.

---

### 2.2 Student Profile & Resume Engine
- **Resume Upload & Parsing**: Supports PDF resume uploads. Uses Google Gemini AI to parse candidate credentials without hallucinating non-existent skills or experience.
- **Profile Metadata**: Stores candidate skills, education, projects, certifications, ATS score, profile photo, GitHub, LinkedIn, and Portfolio links.
- **ATS Resume Analyzer**: Displays parsed skills and resume matching metrics inside the profile section (`Profile.jsx`).

---

### 2.3 AI-Powered Resume-Based Mock Interview Engine
- **Automated Question Generation**: Generates 33 tailored questions per uploaded resume using Gemini 2.5 Flash:
  - 10 Project / Resume-specific questions.
  - 20 Technical questions (Easy, Medium, Hard).
  - 3 Coding questions tailored to candidate's programming languages.
- **Real-Time Technical Evaluation**: Evaluates candidate responses line-by-line, providing scores (0–10) and feedback detailing correctness, missing key points, and suggested improvements (`server.js`, `aiEvaluationController.js`).
- **Session Results & Breakdown**: Complete scorecard displaying technical score, coding score, domain mastery, and downloadable result summaries (`Results.jsx`, `InterviewResult.jsx`).

---

### 2.4 Company-Wise Mock Interview Module
- **Hiring Process Simulator**: Simulates hiring drives for top companies (Google, TCS, Infosys, Wipro, Accenture, Cognizant, Capgemini, Tech Mahindra).
- **Multi-Round Workflow**: Guided progression across standard rounds:
  1. Aptitude Round
  2. Technical MCQs & Conceptual Round
  3. Coding Assessment
  4. HR / Behavioral Interview
- **Company History & Analytics**: Full attempt history tracking with per-company scorecards and performance metrics (`CompanyMockInterview.jsx`, `CompanyMockHistory.jsx`).

---

### 2.5 Practice & Skill Assessment Engine
- **Aptitude Practice Round**: Category-wise practice (Quantitative, Logical Reasoning, Verbal Ability) with timed MCQs, bookmarking capabilities, instant explanations, and category score tracking (`AptitudeRound.jsx`, `AptitudeHistory.jsx`).
- **Coding Practice Round**: Code editor with multi-language support (JavaScript, Python, C++, Java), sample & hidden test case verification, execution output console, and submission history (`CodingRound.jsx`, `CodingHistory.jsx`).
- **Question Bookmarks System**: Save difficult questions to a personal revision library (`Bookmarks.jsx`).

---

### 2.6 Assigned Test Engine & Mock Online Assessment (OA)
- **Live Test Interface**: Timed test environment with question navigation grid, single/multiple-choice selections, auto-submit on time expiry, and window focus tracking (`TestEngine.jsx`).
- **Instant Result Evaluation**: Comprehensive performance card upon test submission showing percentage, pass/fail status, correct/wrong count, and detailed answer key (`TestResult.jsx`).
- **Available Tests Portal**: Dashboard listing tests assigned specifically to the student's department/year (`AvailableTests.jsx`).

---

### 2.7 Placement & Institutional Analytics (Student View)
- **Placement Dashboard**: Centralized readiness metrics, benchmark scores, company eligibility indicators (`PlacementDashboard.jsx`).
- **Leaderboards**: Department-wise and overall college rankings (`Leaderboard.jsx`).
- **Mock OA Simulator**: Full-length placement mock assessment with combined section timers (`MockOA.jsx`).
- **Performance & Skill Graphs**: Visual charts rendering performance trends, domain strengths/weaknesses (DBMS, OS, DSA, Web Dev) (`PerformanceGraphs.jsx`, `QuestionAnalytics.jsx`).
- **Gamified Achievements**: Badges, streaks, and milestone achievements (`Achievements.jsx`).

---

### 2.8 Admin Control Center & Institutional Management
- **Admin Dashboard**: 7 KPI metric cards, score distribution donut chart, department breakdown charts, and live activity feeds (`AdminDashboard.jsx`).
- **Student Candidate Directory**: Full table view with department/year filtering, text search, pagination, profile view, edit modal, and cascade deletion (`StudentsList.jsx`, `StudentDetails.jsx`).
- **Test Creation Wizard**: 4-step test creation process (Test Info, Subjects/Languages, Question Entry via Manual or CSV Upload, Department/Year/Batch Assignment) (`CreateTest.jsx`).
- **Assigned Tests Monitor**: Live monitor for active test assignments, tracking started/completed counts, auto-submits, average scores, and CSV exports (`AssignedTests.jsx`).

---

### 2.9 Content & Question Bank Management
- **Aptitude Management**: MCQ question management with category tags, CSV import parser, and 30-day trash recovery system (`AptitudeManagement.jsx`).
- **Coding Question Management**: Problem statement editor, input/output test cases, memory/time limits, language support, and trash recovery (`CodingQuestionManagement.jsx`).
- **Technical Question Bank**: Domain-wise technical question management (`AdminTechnicalManagement.jsx`).
- **Company Management**: Company profile creation, test pattern configuration, cutoff settings, and branding styling (`CompanyManagement.jsx`).

---

### 2.10 Automated Reporting, Export & Governance Center
- **Reports Module**: Dedicated reporting dashboard with 4 tabs (Student Reports, Batch Reports, Company Reports, Practice Reports) (`ReportsModule.jsx`).
- **Multi-Format Export Support**:
  - Professional PDF export via `PDFKit` (`pdfGenerator.js`).
  - Multi-sheet Excel workbook export via `XLSX` (`excelGenerator.js`).
  - Automated CSV export background sync for database tables (`csvExporter.js`).
- **Direct Emailing Engine**: Integrated SMTP mailing via Nodemailer for delivering performance reports directly to candidate emails (`emailSender.js`, `EmailManagement.jsx`).
- **System Governance**: Audit logging (`AuditLogs.jsx`), System Configuration (`SystemConfig.jsx`), System Notifications broadcast (`NotificationsPage.jsx`), and Backup Dashboard (`BackupDashboard.jsx`).

---

## 3. Database Schema Overview (MongoDB Collections)

| Collection | Model File | Purpose |
| :--- | :--- | :--- |
| `users` | `User.js` | Student accounts, profiles, resume parsed metadata, ATS scores |
| `admins` | `Admin.js` | Admin credentials & system roles |
| `tests` | `Test.js` | Master test templates, questions array, subjects, duration |
| `testassignments` | `TestAssignment.js` | Assigned test instances linked to departments, years, or students |
| `testresults` | `TestResult.js` | Completed test evaluation records & section scores |
| `interviews` | `Interview.js` | AI Resume mock interview sessions |
| `answers` | `Answer.js` | Individual interview question answers & scores |
| `results` | `Result.js` | Overall final scorecards & AI feedback summaries |
| `aievaluations` | `AIEvaluation.js` | Detailed Gemini AI evaluations and readiness metrics |
| `aptitudequestions` | `AptitudeQuestion.js` | Quantitative, logical, and verbal question bank |
| `codingquestions` | `CodingQuestion.js` | Coding problem bank with test cases |
| `companies` | `Company.js` | Company profiles, hiring criteria, test patterns |
| `reporthistories` | `ReportHistory.js` | Audit trail of all generated, downloaded, or emailed reports |
| `auditlogs` | `AuditLog.js` | System activity log |
| `systemconfigs` | `SystemConfig.js` | Global app configuration settings |
| `notifications` | `Notification.js` | System notifications sent to users |

---

## 4. Verification & Health Status
- **Backend Entry Point**: `server.js` running on `http://localhost:5000` with `/api/health` endpoint.
- **Frontend Entry Point**: Vite dev server on `http://localhost:5173`.
- **Database Status**: Mongo Atlas connection active with auto-seeding routines for default companies and default question sets.
