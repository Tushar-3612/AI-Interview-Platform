
# AI-Powered Resume-Based Mock Interview and Candidate Evaluation Platform

A full-stack MERN application that enables students to practice AI-driven mock interviews tailored to their resumes, with automated evaluation and placement analytics for institutions.

---

## Project Overview

This platform helps college students prepare for technical placements through resume-based mock interviews powered by Google Gemini AI. Students upload their resume, receive personalized interview questions, and get AI-evaluated feedback. Administrators can monitor candidate performance and export data for institutional reporting.

The current release includes a **premium SaaS-grade Authentication Module** with light/dark theme support, animated split-screen UI, JWT-based auth, and automated CSV backup exports.

---

## Features

### Authentication (Current Release)
- Student registration with college email, department, and year
- Secure login with bcrypt password hashing and JWT tokens
- Hardcoded admin login (no admin signup)
- Light / Dark theme toggle with localStorage persistence
- Premium split-screen UI with parallax 3D illustration
- Framer Motion animations (fade, slide, scale, hover, ripple)
- Form validation with toast notifications
- Responsive design (desktop, tablet, mobile)

### Interview Engine (Planned)
- PDF resume upload and AI analysis
- Resume-based, technical, and coding question generation
- Voice interview mode
- Real-time AI evaluation and scoring

### Admin Panel (Planned)
- Candidate management dashboard
- Interview analytics and placement reports
- CSV data export for backup and reporting

---

## Folder Structure

```
ai-interview-engine/
├── backend/
│   ├── config/
│   │   └── db.js                  # MongoDB Atlas connection
│   ├── controllers/
│   │   └── authController.js      # Signup & login logic
│   ├── exports/                   # Auto-synced CSV backup files
│   │   ├── users.csv
│   │   ├── interviews.csv
│   │   ├── answers.csv
│   │   └── results.csv
│   ├── middleware/
│   │   └── authMiddleware.js      # JWT verification & role guard
│   ├── models/
│   │   ├── User.js                # Student accounts
│   │   ├── Admin.js               # Admin metadata schema
│   │   ├── Interview.js           # Interview sessions
│   │   ├── Answer.js              # Question responses
│   │   └── Result.js              # Final evaluations
│   ├── routes/
│   │   └── auth.js                # Auth API routes
│   └── utils/
│       ├── generateToken.js       # JWT generation
│       └── csvExporter.js         # CSV auto-sync system
├── frontend/
│   └── src/
│       ├── assets/                # Static assets
│       ├── components/
│       │   ├── auth/              # Auth-specific components
│       │   │   ├── PremiumIllustration.jsx
│       │   │   ├── FeatureCard.jsx
│       │   │   └── AuthDivider.jsx
│       │   └── ui/                # Reusable UI components
│       │       ├── Button.jsx
│       │       ├── InputField.jsx
│       │       ├── Logo.jsx
│       │       └── ThemeToggle.jsx
│       ├── hooks/
│       │   ├── useTheme.jsx       # Light/dark theme context
│       │   └── useMouseParallax.js
│       ├── layouts/
│       │   └── AuthLayout.jsx     # 60/40 split-screen layout
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Signup.jsx
│       │   └── RegistrationSuccess.jsx
│       ├── routes/
│       │   └── AppRoutes.jsx
│       ├── styles/
│       │   ├── theme.css          # CSS custom properties
│       │   └── globals.css        # Global styles & animations
│       └── utils/
│           ├── api.js             # Axios instance
│           ├── constants.js       # App constants
│           └── validators.js        # Form validation helpers
├── server.js                      # Express entry point
├── .env.example                   # Environment variable template
└── README.md
```

---

## Technology Stack

| Layer      | Technologies                                      |
|------------|---------------------------------------------------|
| Frontend   | React 19, Vite, Tailwind CSS 4, React Router DOM |
| UI/UX      | Framer Motion, Lucide React, Poppins Font          |
| Backend    | Node.js, Express 5                                 |
| Database   | MongoDB Atlas, Mongoose 9                          |
| Auth       | bcryptjs, JSON Web Tokens (JWT)                    |
| AI Engine  | Google Gemini 2.5 Flash                            |
| HTTP       | Axios, CORS                                        |

---

## Architecture

```
┌─────────────────┐     REST API      ┌──────────────────┐
│  React Frontend │ ◄──────────────► │  Express Backend  │
│  (Vite + TW)    │                   │  (Node.js)        │
└─────────────────┘                   └────────┬─────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                        MongoDB Atlas   CSV Exports   Gemini AI
                        (Primary DB)    (Admin Backup) (Interview)
```

- **MongoDB Atlas** is the primary database for all application data.
- **CSV files** in `backend/exports/` are automatically synced for admin backup and reporting.
- **JWT tokens** carry user role (`student` | `admin`) for route protection.

---

## Database Collections

| Collection    | Purpose                                    |
|---------------|--------------------------------------------|
| `users`       | Student accounts (name, email, department) |
| `admins`      | Admin metadata (login is hardcoded)        |
| `interviews`  | Interview session records                  |
| `answers`     | Individual question responses              |
| `results`     | Final evaluation scores and feedback       |

---

## CSV Export System

CSV files in `backend/exports/` serve as admin-only backup and export data. MongoDB remains the source of truth.

| Event                    | CSV Updated        |
|--------------------------|--------------------|
| New student registers    | `users.csv`        |
| Interview starts         | `interviews.csv`   |
| Interview completes      | `interviews.csv`   |
| Answer submitted         | `answers.csv`      |
| Final result generated   | `results.csv`      |

Export hooks are available in `backend/utils/csvExporter.js`:

```javascript
import { onUserRegistered, onInterviewStarted, onInterviewCompleted, onAnswerSubmitted, onResultGenerated } from "./backend/utils/csvExporter.js";
```

---

## Authentication Flow

### Student Signup
1. Student fills registration form (name, email, department, year, password)
2. Server validates input and checks for duplicate email
3. Password is hashed with bcrypt and saved to MongoDB `users` collection
4. `users.csv` is automatically updated
5. Student is redirected to Registration Success page

### Student Login
1. Student enters email and password
2. Server verifies credentials against MongoDB
3. JWT is generated with `role: "student"`
4. Token stored in localStorage (Remember Me) or sessionStorage
5. Redirect to Student Dashboard (coming soon)

### Admin Login
1. Admin enters hardcoded credentials:
   - **Email:** `sanjivani@admin.org.in`
   - **Password:** `Admin@123`
2. Server validates against hardcoded values (not stored in MongoDB)
3. JWT is generated with `role: "admin"`
4. Redirect to Admin Dashboard (coming soon)

---

## Future Scope

- [ ] Student Dashboard with interview history
- [ ] Admin Dashboard with analytics and CSV download
- [ ] Resume upload and AI question generation UI
- [ ] Voice-based interview mode
- [ ] Real-time coding round with code editor
- [ ] PDF report generation for interview results
- [ ] Email verification and password reset
- [ ] Multi-attempt tracking and limits
- [ ] Department-wise placement analytics

---

## Installation Guide

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- Google Gemini API key

### 1. Clone the repository

```bash
git clone <repository-url>
cd ai-interview-engine
```

### 2. Install dependencies

```bash
# Backend dependencies
npm install

# Frontend dependencies
cd frontend
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

### 4. Start the backend

```bash
node server.js
```

Server runs on `http://localhost:5000`

### 5. Start the frontend

```bash
cd frontend
npm run dev
```

App runs on `http://localhost:5173`

---

## Environment Variables

| Variable         | Description                          | Example                                      |
|------------------|--------------------------------------|----------------------------------------------|
| `MONGO_URI`      | MongoDB Atlas connection string      | `mongodb+srv://user:pass@cluster.mongodb.net/ai-interview` |
| `JWT_SECRET`     | Secret key for JWT signing           | `your_super_secret_jwt_key`                  |
| `GEMINI_API_KEY` | Google Gemini API key                | `AIzaSy...`                                  |
| `VITE_API_URL`   | Backend URL (frontend, optional)     | `http://localhost:5000`                      |

---

## Screenshots

> Screenshots will be added as modules are completed.

| Page                  | Status       |
|-----------------------|--------------|
| Login (Light Mode)    | ✅ Complete  |
| Login (Dark Mode)     | ✅ Complete  |
| Signup                | ✅ Complete  |
| Registration Success  | ✅ Complete  |
| Student Dashboard     | 🔜 Planned   |
| Admin Dashboard       | 🔜 Planned   |
| Interview Module      | 🔜 Planned   |

---

## License

This project is developed as a Final Year Project. All rights reserved.

---

## Contributors

| Name           | Role              |
|----------------|-------------------|
| Tushar Nagare  | Full Stack Developer |
| Roshan Langhi  | Testing & Quality Assurance |


---

<p align="center">
  Built with React, Node.js, MongoDB, and Google Gemini AI
</p>
=======
# 🤖 AI Interview Platform

An AI-powered interview platform that helps candidates practice technical and HR interviews while enabling recruiters and organizations to conduct automated, intelligent interview sessions.

## 🚀 Features

- 🎤 AI-powered interview questions
- 💬 Real-time conversational interview experience
- 🧠 Intelligent answer evaluation
- 📊 Candidate performance analysis
- 📈 Interview score and feedback
- 📝 Technical & HR interview support
- 🔒 Secure authentication
- 👤 Candidate profile management
- 📂 Interview history
- 📱 Responsive UI

---

## 🛠️ Tech Stack

### Frontend
- React.js
- Next.js
- TypeScript
- Tailwind CSS
- Shadcn UI

### Backend
- Node.js
- Express.js
- REST API

### Database
- MongoDB

### Authentication
- Clerk / JWT Authentication

### AI
- OpenAI API / Google Gemini API

### Deployment
- Vercel
- Render / Railway

>>>>>>> 611cb9d78d6f52693b356c09a2f74787e73ec306
