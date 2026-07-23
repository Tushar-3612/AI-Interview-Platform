# Admin Module — Implementation Guide

## 1. Folder Structure

### New Folders Created
None. All code lives in existing folders.

### New Files Created

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `backend/controllers/testController.js` | Full CRUD for Tests, Questions, Assignments |
| 2 | `backend/models/Test.js` | Test schema with title, type, questions, subjects, languages |
| 3 | `backend/models/TestAssignment.js` | Assignment schema linking tests to students with tracking stats |
| 4 | `frontend/src/pages/admin/AdminDashboard.jsx` | Dashboard with 7 stat cards + 4 widgets |
| 5 | `frontend/src/pages/admin/StudentsList.jsx` | Full student table with search, filter, sort, pagination, CRUD modals |
| 6 | `frontend/src/pages/admin/StudentDetails.jsx` | Student profile detail with resume section + interview history |
| 7 | `frontend/src/pages/admin/CreateTest.jsx` | 4-tab test creation form (Details, Subjects, Questions, Assign) |
| 8 | `frontend/src/pages/admin/AssignedTests.jsx` | Expandable assignment list with stats, export, delete |

### Existing Files Modified

| # | File Path | What Changed |
|---|-----------|-------------|
| 1 | `backend/routes/test.js` | Added 5 new routes (addQuestion, updateQuestion, deleteQuestion, getAssignmentById, updateAssignmentStatus) |
| 2 | `frontend/src/routes/AppRoutes.jsx` | Added 5 admin routes: dashboard, students list, student details, create test, assigned tests |
| 3 | `frontend/src/layouts/AdminLayout.jsx` | Rewrote sidebar with only 4 nav items (Dashboard, Students, Create Test, Assigned Tests) |

---

## 2. Backend Changes

### 2.1 New Routes (`backend/routes/test.js`)

```
POST   /api/tests                   → createTest
GET    /api/tests                   → getTests
GET    /api/tests/:id               → getTestById
PUT    /api/tests/:id               → updateTest
DELETE /api/tests/:id               → deleteTest
POST   /api/tests/questions/:id     → addQuestion       (NEW)
PUT    /api/tests/questions/:id/:questionId → updateQuestion  (NEW)
DELETE /api/tests/questions/:id/:questionId → deleteQuestion  (NEW)
POST   /api/tests/assign            → assignTest
GET    /api/tests/assignments/list  → getAssignedTests
GET    /api/tests/assignments/:id   → getAssignmentById (NEW)
PUT    /api/tests/assignments/:id   → updateAssignmentStatus (NEW)
DELETE /api/tests/assignments/:id   → deleteAssignment
```

All routes are protected by `authMiddleware` and `authorizeRoles("admin")`.

### 2.2 Existing Routes Already Present (`backend/routes/admin.js`)

```
GET    /api/admin/stats              → getStats
GET    /api/admin/students           → getStudents
GET    /api/admin/students/:id       → getStudentDetails
PUT    /api/admin/students/:id       → updateStudent
DELETE /api/admin/students/:id       → deleteStudent
POST   /api/admin/students/:id/email-report → emailReport
GET    /api/admin/students/:id/pdf   → downloadSinglePDF
GET    /api/admin/students/:id/csv   → exportSingleReport
GET    /api/admin/reports/export-all → exportAllReport
GET    /api/admin/companies          → getCompanies
POST   /api/admin/companies          → addCompany
PUT    /api/admin/companies/:id      → updateCompany
DELETE /api/admin/companies/:id      → deleteCompany
GET    /api/admin/companies/analytics → getCompanyAnalytics
GET    /api/admin/interviews/report  → getInterviewsReport
GET    /api/admin/analytics          → getAnalytics
GET    /api/admin/resumes/list       → getResumes
```

### 2.3 New Controller (`backend/controllers/testController.js`)

Contains 11 exported functions:

| Function | Purpose |
|----------|---------|
| `createTest` | Create a new test with title, type, questions, subjects, languages |
| `getTests` | List all tests sorted by newest |
| `getTestById` | Get single test by ID |
| `updateTest` | Update any test field |
| `deleteTest` | Delete test + cascade delete assignments |
| `addQuestion` | Push a question into a test's questions array |
| `updateQuestion` | Update a single question by its subdocument ID |
| `deleteQuestion` | Pull a question from the questions array |
| `assignTest` | Assign test to students (by department, year, all, or individual IDs) |
| `getAssignedTests` | Get all assignments with populated test + student data |
| `getAssignmentById` | Get single assignment detail |
| `deleteAssignment` | Remove an assignment |
| `updateAssignmentStatus` | Update assignment stats (startedCount, completedCount, etc.) |

### 2.4 New Models

#### `backend/models/Test.js`

```javascript
{
  title:           String (required),
  description:     String (default: ""),
  companyId:       String (default: ""),
  testType:        String (enum: aptitude | technical | coding | mixed, required),
  difficulty:      String (enum: Easy | Medium | Hard, default: "Medium"),
  duration:        Number (default: 30, minutes),
  passingMarks:    Number (default: 40, percentage),
  attemptLimit:    Number (default: 1),
  questionSource:  String (enum: manual | csv | ai, default: "manual"),
  status:          String (enum: draft | scheduled | live | completed, default: "draft"),
  scheduledAt:     Date,
  subjects:        [String],       // e.g. ["Java", "DBMS", "OS"]
  codingLanguages: [String],       // e.g. ["Python", "JavaScript"]
  questions:       [{
    question:      String (required),
    options:       [String],
    correctAnswer: String,
    marks:         Number (default: 1),
    subject:       String,
    difficulty:    String (easy | medium | hard)
  }],
  createdBy:       ObjectId (ref: Admin)
}
```

#### `backend/models/TestAssignment.js`

```javascript
{
  testId:           ObjectId (ref: Test, required),
  assignType:       String (enum: department | year | section | individual | multiple | all, required),
  assignValue:      String (default: ""),
  studentIds:       [ObjectId] (ref: User),
  startedCount:     Number (default: 0),
  completedCount:   Number (default: 0),
  notAttemptedCount: Number (default: 0),
  autoSubmittedCount: Number (default: 0),
  averageScore:      Number (default: 0),
  status:           String (enum: active | completed | archived, default: "active"),
  assignedBy:       ObjectId (ref: Admin)
}
```

Virtuals (computed, not stored):
- `totalStudents` → studentIds.length
- `pendingCount` → totalStudents - completedCount - autoSubmittedCount

### 2.5 Middleware

No new middleware. Both `authMiddleware.js` and `authorizeRoles` were already present.

### 2.6 Services / Utils

The following utility modules were already present (no changes):

| File | Purpose |
|------|---------|
| `backend/utils/pdfGenerator.js` | Generate student performance PDF via PDFKit |
| `backend/utils/emailSender.js` | Send report emails via Nodemailer |
| `backend/utils/reportExporter.js` | Export student data as CSV |

---

## 3. Frontend Changes

### 3.1 New Pages

| Page | Route | Purpose |
|------|-------|---------|
| `AdminDashboard.jsx` | `/admin/dashboard` | 7 stat cards + Department/Company charts + Donut + Activity feed + Assigned tests table |
| `StudentsList.jsx` | `/admin/students` | Full table with profile photo, name, email, phone, dept, year, resume status, practice/real counts, avg score, status. Search, filter, sort, pagination. Edit modal, delete modal. |
| `StudentDetails.jsx` | `/admin/students/:id` | Profile card with social links, Resume preview/download/ATS, Practice interviews grouped by company (attempts/best/avg/latest), Real interviews list |
| `CreateTest.jsx` | `/admin/tests/create` | 4-tab form: Details (title, type, duration, etc.), Subjects (chip selector), Questions (add/edit/delete/csv import), Assign (by department/year/all/individual) |
| `AssignedTests.jsx` | `/admin/tests/assigned` | Searchable expandable list with stats (total/completed/pending/avg score), detail modal, CSV export, delete confirmation |

### 3.2 No New Components, Hooks, or Services

The admin pages reuse existing:
- `frontend/src/hooks/useStudentProfile.js` for `getAuthToken()` and `getAuthUser()`
- `frontend/src/utils/api.js` for axios instance
- `frontend/src/hooks/useTheme.js` for dark/light mode
- `frontend/src/components/ui/Logo.jsx` for the logo

### 3.3 Frontend Routes (in `AppRoutes.jsx`)

```javascript
<Route element={<AdminLayout />}>
  <Route path="/admin/dashboard" element={<AdminDashboard />} />
  <Route path="/admin/students" element={<StudentsList />} />
  <Route path="/admin/students/:id" element={<StudentDetails />} />
  <Route path="/admin/tests/create" element={<CreateTest />} />
  <Route path="/admin/tests/assigned" element={<AssignedTests />} />
</Route>
```

### 3.4 Frontend API Calls

All admin pages use `api.get/post/put/delete` from `frontend/src/utils/api.js`.

Headers are set manually per-call:
```javascript
const token = getAuthToken();
const headers = { Authorization: `Bearer ${token}` };
```

No custom interceptor is needed because the hook already reads from localStorage/sessionStorage.

---

## 4. Database Changes

### 4.1 New MongoDB Collections

| Collection Name | Created By | Purpose |
|-----------------|-----------|---------|
| `tests` | `Test.js` model | Stores all created tests with questions, subjects, languages |
| `testassignments` | `TestAssignment.js` model | Stores assignment records linking tests to students |

### 4.2 Schemas

#### `tests` Collection Schema

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| title | String | Yes | — | Test name |
| description | String | No | "" | Optional description |
| companyId | String | No | "" | Company name/ID string |
| testType | String | Yes | — | aptitude, technical, coding, mixed |
| difficulty | String | No | "Medium" | Easy, Medium, Hard |
| duration | Number | No | 30 | In minutes |
| passingMarks | Number | No | 40 | Percentage to pass |
| attemptLimit | Number | No | 1 | Max attempts per student |
| questionSource | String | No | "manual" | manual, csv, ai |
| status | String | No | "draft" | draft, scheduled, live, completed |
| scheduledAt | Date | No | null | For scheduled tests |
| subjects | [String] | No | [] | Technical subjects |
| codingLanguages | [String] | No | [] | Coding languages |
| questions | [Embedded] | No | [] | Array of question subdocuments |
| createdBy | ObjectId | No | null | Ref → admins collection |
| createdAt | Date | Auto | — | Timestamps |
| updatedAt | Date | Auto | — | Timestamps |

#### `testassignments` Collection Schema

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| testId | ObjectId | Yes | — | Ref → tests |
| assignType | String | Yes | — | department, year, section, individual, multiple, all |
| assignValue | String | No | "" | e.g. "Computer Engineering", "TE" |
| studentIds | [ObjectId] | No | [] | Ref → users |
| startedCount | Number | No | 0 | Students who started |
| completedCount | Number | No | 0 | Students who completed |
| notAttemptedCount | Number | No | 0 | Students who didn't attempt |
| autoSubmittedCount | Number | No | 0 | Auto-submitted on time expiry |
| averageScore | Number | No | 0 | Average score across all students |
| status | String | No | "active" | active, completed, archived |
| assignedBy | ObjectId | No | null | Ref → admins |
| createdAt | Date | Auto | — | Timestamps |
| updatedAt | Date | Auto | — | Timestamps |

### 4.3 Relationships

```
Test ──1:N──> TestAssignment ──N:1──> User (student)
  │                                      │
  └──> Embedded questions []             └──> Interview, Result, Answer
```

- A `Test` has many `TestAssignment` records (one per assign action)
- A `TestAssignment` links one `Test` to many `User` students
- Each `Test` embeds its own `questions` array (no separate questions collection)
- Cascade delete: deleting a `Test` deletes all its `TestAssignment` records

---

## 5. API Documentation

### Admin Auth

All admin endpoints require `Authorization: Bearer <token>` header. The token must belong to a user with `role: "admin"`.

---

### Dashboard Stats

```
GET /api/admin/stats
Auth: Required (Admin)
Response:
{
  "metrics": {
    "totalStudents": 150,
    "totalPracticeInterviews": 320,
    "totalRealInterviews": 45,
    "totalResumes": 98,
    "totalActiveTests": 12,
    "totalCompletedTests": 8,
    "avgScore": 62,
    "topPerformer": { "name": "John Doe", "score": 92 }
  },
  "recentActivities": [
    { "type": "signup|interview|assignment", "message": "...", "timestamp": "...", "id": "..." }
  ],
  "charts": {
    "scoreDistribution": { "excellent": 10, "good": 25, "average": 40, "poor": 20 },
    "activityChart": [{ "date": "Jul 13", "attempts": 12 }, ...],
    "deptBreakdown": [{ "name": "Computer Engineering", "value": 45 }, ...]
  },
  "companyOverview": [
    { "name": "Google", "color": "#4285F4", "attempts": 85, "avgScore": 68 }
  ],
  "assignedTestsWidget": [
    { "_id": "...", "testName": "Tech Test", "studentCount": 30, "completedCount": 15, "averageScore": 72, ... }
  ]
}
```

---

### List Students

```
GET /api/admin/students?search=john&department=Computer Engineering&year=BE&page=1&limit=10
Auth: Required (Admin)
Response:
{
  "students": [
    {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "department": "Computer Engineering",
      "year": "BE",
      "phone": "9876543210",
      "resumeFileName": "resume.pdf",
      "atsScore": 78,
      "skills": ["Java", "Python"],
      "profilePicture": null,
      "github": "",
      "linkedin": "",
      "portfolio": "",
      "attempts": 5,
      "avgScore": 72,
      "highestScore": 88
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "pages": 15
  }
}
```

---

### Get Student Details

```
GET /api/admin/students/:id
Auth: Required (Admin)
Response:
{
  "student": { ...all user fields excluding password... },
  "interviewHistory": [
    {
      "_id": "...",
      "interviewType": "practice|real",
      "companyId": "google",
      "status": "completed",
      "overallScore": 78,
      "createdAt": "...",
      "result": { "overallScore": 78, "technicalScore": 72, "codingScore": 80, ... },
      "answers": [ ... ]
    }
  ],
  "companyAnalytics": [
    {
      "companyId": "google",
      "companyName": "Google",
      "color": "#4285F4",
      "attempts": 3,
      "bestScore": 88,
      "averageScore": 78,
      "latestScore": 82,
      "interviewDates": ["..."]
    }
  ]
}
```

---

### Update Student

```
PUT /api/admin/students/:id
Auth: Required (Admin)
Body: { name, department, year, phone, portfolio, github, linkedin, skills, atsScore }
Response: { "message": "Student profile updated successfully", "student": {...} }
```

---

### Delete Student

```
DELETE /api/admin/students/:id
Auth: Required (Admin)
Response: { "message": "Student and all associated records deleted successfully" }
```

Cascade deletes: answers, results, interviews, user record.

---

### Create Test

```
POST /api/tests
Auth: Required (Admin)
Body:
{
  "title": "Technical Assessment 2025",
  "description": "Test for BE students",
  "testType": "technical",
  "companyId": "Google",
  "difficulty": "Medium",
  "duration": 30,
  "passingMarks": 40,
  "attemptLimit": 1,
  "questionSource": "manual",
  "status": "draft",
  "scheduledAt": "",
  "subjects": ["Java", "DBMS"],
  "codingLanguages": [],
  "questions": [
    {
      "question": "What is JVM?",
      "type": "MCQ",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "marks": 1,
      "negativeMarks": 0
    }
  ]
}
Response: { "message": "Test created", "test": {...} }
```

---

### Get All Tests

```
GET /api/tests
Auth: Required (Admin)
Response: [ { test1 }, { test2 }, ... ]
```

---

### Get Test By ID

```
GET /api/tests/:id
Auth: Required (Admin)
Response: { test document }
```

---

### Update Test

```
PUT /api/tests/:id
Auth: Required (Admin)
Body: { any test fields to update }
Response: { "message": "Test updated", "test": {...} }
```

---

### Delete Test

```
DELETE /api/tests/:id
Auth: Required (Admin)
Response: { "message": "Test deleted" }
```

Cascade deletes all assignments linked to this test.

---

### Add Question to Test

```
POST /api/tests/questions/:testId
Auth: Required (Admin)
Body:
{
  "question": "What is polymorphism?",
  "type": "MCQ",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": "A",
  "marks": 1,
  "negativeMarks": 0
}
Response: { "message": "Question added", "test": {...} }
```

---

### Update Question

```
PUT /api/tests/questions/:testId/:questionId
Auth: Required (Admin)
Body: { any question fields to update }
Response: { "message": "Question updated", "test": {...} }
```

---

### Delete Question

```
DELETE /api/tests/questions/:testId/:questionId
Auth: Required (Admin)
Response: { "message": "Question deleted", "test": {...} }
```

---

### Assign Test

```
POST /api/tests/assign
Auth: Required (Admin)
Body:
{
  "testId": "...",
  "assignType": "department",   // all | department | year | section | individual | multiple
  "assignValue": "Computer Engineering",  // required when assignType is department/year/section
  "studentIds": ["id1", "id2"]  // required when assignType is individual/multiple
}
Response: { "message": "Test assigned", "assignment": {...} }
```

If a matching assignment already exists, it merges student IDs instead of duplicating.

---

### Get All Assigned Tests

```
GET /api/tests/assignments/list
Auth: Required (Admin)
Response:
[
  {
    "_id": "...",
    "testId": { "title": "...", "testType": "...", "duration": 30 },
    "assignType": "department",
    "assignValue": "Computer Engineering",
    "studentIds": [ { "_id": "...", "name": "...", "email": "...", "department": "...", "year": "..." } ],
    "status": "active",
    "startedCount": 5,
    "completedCount": 3,
    "notAttemptedCount": 22,
    "autoSubmittedCount": 0,
    "averageScore": 68,
    "totalStudents": 30,
    "pendingCount": 27,
    "createdAt": "..."
  }
]
```

---

### Get Assignment By ID

```
GET /api/tests/assignments/:id
Auth: Required (Admin)
Response: { single assignment with populated test + students }
```

---

### Update Assignment Status

```
PUT /api/tests/assignments/:id
Auth: Required (Admin)
Body: { status, startedCount, completedCount, notAttemptedCount, autoSubmittedCount, averageScore }
Response: { "message": "Assignment updated", "assignment": {...} }
```

---

### Delete Assignment

```
DELETE /api/tests/assignments/:id
Auth: Required (Admin)
Response: { "message": "Assignment removed" }
```

---

## 6. Environment Variables

### Root `.env` (already existed, no changes needed)

```
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/InterviewPlatform?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key
GEMINI_API_KEY=your_gemini_api_key_here
```

### Frontend `.env`

No frontend `.env` file is required because the Vite dev server proxies `/api` requests to `http://localhost:5000` (configured in `frontend/vite.config.js`).

If you deploy the frontend separately (e.g., Vercel/Netlify), create `frontend/.env`:
```
VITE_API_URL=https://your-backend-url.com
```

---

## 7. Required npm Packages

### Root (Backend) `package.json` — Already Installed

| Package | Version | Why It's Needed |
|---------|---------|----------------|
| `express` | ^4.22.2 | Web framework for routing and HTTP handling |
| `mongoose` | ^7.0.0 | MongoDB ODM for schema modeling and querying |
| `jsonwebtoken` | ^9.0.0 | JWT generation and verification for auth |
| `bcryptjs` | ^2.4.3 | Password hashing for student/admin accounts |
| `cors` | ^2.8.5 | Cross-Origin Resource Sharing for frontend-backend communication |
| `dotenv` | ^16.0.3 | Load `.env` file into `process.env` |
| `multer` | ^1.4.5-lts.1 | File upload handling (resume PDFs) |
| `nodemailer` | ^9.0.3 | Send email reports to students |
| `pdfkit` | ^0.19.1 | Generate PDF reports for student performance |
| `@google/genai` | ^1.0.0 | Google Gemini API integration for AI resume analysis |
| `nodemon` (dev) | ^2.0.22 | Auto-restart server during development |

### Frontend `package.json` — Already Installed

| Package | Why It's Needed |
|---------|----------------|
| `react` / `react-dom` | UI framework |
| `react-router-dom` | Client-side routing |
| `axios` | HTTP client for API calls |
| `framer-motion` | Animations and transitions |
| `lucide-react` | Icon library |
| `react-hot-toast` | Toast notifications |
| `tailwindcss` | Utility-first CSS framework |
| `@tailwindcss/vite` | Tailwind CSS Vite plugin |
| `vite` | Build tool and dev server |
| `@vitejs/plugin-react` | React support for Vite |

**No new packages need to be installed.** All dependencies were already present.

---

## 8. Manual Configuration

### 8.1 MongoDB

1. Create a free cluster at [MongoDB Atlas](https://cloud.mongodb.com)
2. Get your connection string
3. Set it in `.env` as `MONGO_URI`

No new collections need to be created manually. Mongoose will create `tests` and `testassignments` automatically when you first use the models.

Default companies (Google, Microsoft, Amazon, etc.) are auto-seeded on first database connection in `backend/config/db.js`.

### 8.2 JWT

1. Generate a strong random string (use `openssl rand -base64 32` or any password generator)
2. Set it in `.env` as `JWT_SECRET`

The JWT is used for:
- Admin login/session
- Protecting all API routes
- Identifying the user making the request (`req.user.id`, `req.user.role`)

### 8.3 Gemini API (Google AI)

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create an API key
3. Set it in `.env` as `GEMINI_API_KEY`

The Gemini API is used for:
- Resume analysis and question generation
- Technical answer evaluation
- AI-generated test questions

### 8.4 Nodemailer (Email Reports)

The email sender is in `backend/utils/emailSender.js`. You must configure SMTP credentials.

Default configuration uses Gmail:
```javascript
// In backend/utils/emailSender.js
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL || "your-email@gmail.com",
    pass: process.env.SMTP_PASSWORD || "your-app-password",
  },
});
```

**What you need to do:**
1. Add these to your `.env` file:
   ```
   SMTP_EMAIL=your-email@gmail.com
   SMTP_PASSWORD=your-gmail-app-password
   ```
2. Enable 2-Factor Authentication on your Gmail account
3. Generate an App Password from Google Account → Security → App Passwords
4. Use that app password as `SMTP_PASSWORD`

If you don't configure SMTP, the email function will simulate sending and log to console (it won't crash).

### 8.5 Multer (File Upload)

Already configured in `server.js` using `memoryStorage()`. No additional configuration needed.

Resume PDFs are stored as Base64 strings in MongoDB (in the `User` model's `resumeBase64` field).

### 8.6 CSV Upload for Questions

The Create Test tab supports CSV import for questions. The CSV must have a header row:

```
type,question,option1,option2,option3,option4,correctanswer,marks,negativemarks
MCQ,What is Java?,A,B,C,D,A,1,0
True/False,Is Earth round?,true,false,,,true,1,0
```

No additional packages needed — the parsing is done with plain JavaScript in the browser.

### 8.7 PDF Generation

Uses `pdfkit` (already installed). PDFs are generated on-the-fly when:
- Downloading a single student's PDF report
- Emailing a report with PDF attachment

No additional configuration needed.

### 8.8 CSV Export

Uses plain JavaScript string building. Available for:
- Exporting all assignments (Assigned Tests page)
- Exporting single student report (Students List actions)

No additional configuration needed.

---

## 9. Files You Need to Edit

### 9.1 `server.js` (Root)

**Already done** — test routes are registered at line 10 and line 49:
```javascript
import testRoutes from "./backend/routes/test.js";
app.use("/api/tests", testRoutes);
```

**Only edit if:** You are adding new test-related routes or changing the route prefix.

### 9.2 `frontend/src/routes/AppRoutes.jsx`

**Already done** — admin routes are registered at lines 55-61.

**Only edit if:** You are adding a new admin page. Follow the existing pattern:
```javascript
import NewPage from "../pages/admin/NewPage";
// Inside admin layout route:
<Route path="/admin/your-path" element={<NewPage />} />
```

### 9.3 `frontend/src/layouts/AdminLayout.jsx`

**Already done** — sidebar has 4 nav items.

**Only edit if:** You want to add/remove sidebar items. Add to the `navItems` array:
```javascript
const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin/dashboard" },
  { label: "Students", icon: Users, path: "/admin/students" },
  { label: "Create Test", icon: FilePlus, path: "/admin/tests/create" },
  { label: "Assigned Tests", icon: ClipboardList, path: "/admin/tests/assigned" },
  // Add new items here
];
```

### 9.4 `backend/routes/admin.js`

**Already done** — all routes are registered.

**Only edit if:** You are adding a new admin controller function.

### 9.5 `backend/controllers/adminController.js`

**Already done** — contains enhanced getStats, student CRUD, company management, analytics, resume management.

**Only edit if:** You need to modify how stats are calculated or add new analytics endpoints.

### 9.6 `backend/models/Test.js` and `backend/models/TestAssignment.js`

**Already done** — schemas are created and registered.

**Only edit if:** You need to add fields to the Test or TestAssignment schemas.

### 9.7 `.env` (Root)

**Add these if you want email functionality:**

```
SMTP_EMAIL=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
```

---

## 10. Testing Guide

### 10.1 Prerequisites

1. Backend running: `npm run dev` (from project root)
2. Frontend running: `npm run dev` (from `frontend/` directory)
3. MongoDB connected (check console for "✅ MongoDB Connected Successfully")
4. Admin account exists in the database

### 10.2 Login as Admin

1. Open `http://localhost:5173`
2. Log in with admin credentials (email + password where `role: "admin"`)
3. You should be redirected to `/admin/dashboard`

### 10.3 Test Dashboard

1. Navigate to Dashboard (`/admin/dashboard`)
2. Verify 7 stat cards load with correct numbers
3. Check Department Overview bar chart appears
4. Check Company Overview bar chart appears
5. Check Practice vs Real donut chart
6. Check Recent Activity feed shows students, interviews, assignments
7. Check Recent Assigned Tests widget shows data

### 10.4 Test Student Management

1. Navigate to Students (`/admin/students`)
2. Verify table loads with student data
3. Test search by name or email
4. Test filter by department dropdown
5. Test filter by year dropdown
6. Test pagination (Next/Previous)
7. Click "View" action → should navigate to Student Details page
8. Click "Edit" action → modal opens, edit fields, save
9. Click "Delete" action → confirmation modal, confirm delete
10. Click "View Resume" → new tab opens with resume PDF
11. Click "Download Resume" → PDF downloads

### 10.5 Test Student Details

1. Navigate to any student's detail page
2. Verify profile card with name, email, phone, department, year
3. Check social links (GitHub, LinkedIn, Portfolio) if available
4. Check Resume section with preview/download buttons and ATS score
5. Check Practice Interviews section grouped by company
6. Check Real Interviews section with scores and status

### 10.6 Test Create Test

1. Navigate to Create Test (`/admin/tests/create`)
2. **Details Tab:**
   - Enter a test title
   - Select test type (Aptitude/Technical/Coding/Mixed)
   - Select difficulty
   - Enter duration, passing marks, attempt limit
   - Click "Save as Draft"
   - Verify toast "Test created"
3. **Subjects Tab:**
   - If test type is Technical or Mixed, select subjects by clicking chips
   - If test type is Coding or Mixed, select coding languages
   - Verify selection toggles on/off
4. **Questions Tab:**
   - Click "Add Question" → question card appears
   - Enter question text, select type (MCQ/True-False/Descriptive/Coding)
   - Enter options for MCQ
   - Enter correct answer
   - Set marks and negative marks
   - Add multiple questions
   - Test "Import CSV" with a properly formatted CSV file
   - Delete a question
5. **Assign Tab:**
   - Select "Assign By" (All/Department/Year/Individual)
   - If Department, select department from dropdown
   - If Individual, select student from the list
   - Click "Save" and then "Assign Test"
   - Verify toast displays number of assigned students

### 10.7 Test Publish

1. In Create Test, after saving, click "Publish" button
2. Verify toast "Test published"
3. Check test status changes to "live"

### 10.8 Test Assigned Tests

1. Navigate to Assigned Tests (`/admin/tests/assigned`)
2. Verify assignments list loads
3. Search by test name
4. Click an assignment row to expand
5. Check stats grid (Total Assigned, Completed, Pending, Avg Score)
6. Check test info (Type, Difficulty, Duration)
7. Check student list (if populated)
8. Click eye icon → detail modal opens
9. Click trash icon → delete confirmation, confirm delete
10. Click "Export" → CSV downloads

### 10.9 Test Build

Run `npm run build` in `frontend/` to verify the production build compiles without errors:

```bash
cd frontend
npm run build
```

Expected output:
```
✓ built in 1.25s
```

### 10.10 Test Backend API Directly

Use curl or Postman to test APIs:

```bash
# Login first
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'

# Use returned token for subsequent requests
TOKEN="<your-token>"

# Test dashboard stats
curl http://localhost:5000/api/admin/stats \
  -H "Authorization: Bearer $TOKEN"

# Test create test
curl -X POST http://localhost:5000/api/tests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test 1","testType":"aptitude","duration":30}'

# Test get assignments
curl http://localhost:5000/api/tests/assignments/list \
  -H "Authorization: Bearer $TOKEN"
```

---

## 11. Future Improvements

The following features are intentionally left for future implementation:

### 11.1 Question Bank
- Currently, questions are embedded inside each Test document
- Future: Create a separate `Question` model with categories, tags, difficulty levels, and reuse across tests
- Add a question bank page where admins can manage questions independently

### 11.2 Bulk CSV Export for Assigned Tests
- Currently exports basic CSV with test name, type, status, counts
- Future: Add per-student breakdown within each assignment export

### 11.3 Real-time Test Monitoring
- Currently shows static stats (startedCount, completedCount)
- Future: Add WebSocket or polling-based live tracking showing which students are currently taking a test

### 11.4 Auto-grading for Descriptive Answers
- MCQ and True/False are auto-graded
- Future: Use Gemini API to evaluate descriptive answers and assign scores

### 11.5 Test Analytics Dashboard
- Currently stats are shown per-assignment in the Assigned Tests page
- Future: Create a dedicated analytics sub-page with charts, pass/fail rates, time analysis, question-wise performance

### 11.6 Email Notifications for Test Assignment
- Currently, assigning a test only creates the database record
- Future: Send email notifications to students when a test is assigned, with test link and deadline

### 11.7 Proctoring
- No proctoring system is implemented
- Future: Add tab-switch detection, face detection via webcam, or full proctoring

### 11.8 Role-based Access for Sub-admins
- Currently only "admin" role has access
- Future: Add roles like "super-admin", "moderator", "teacher" with graduated permissions

### 11.9 Test Templates
- Currently each test is created from scratch
- Future: Add test templates (e.g., "Campus Placement Aptitude", "Technical Screening") that pre-fill question types and subjects

### 11.10 Pagination for Assigned Tests
- Currently loads all assignments at once
- Future: Add server-side pagination for large numbers of assignments
