# Reports Module — Implementation Guide

## Overview

The Reports Module generates PDF, CSV, and Excel reports for students, departments, companies, and practice interviews. It reuses existing MongoDB collections (`User`, `TestResult`, `AIEvaluation`, `Interview`, `Result`, `Test`) and does not create any duplicate data.

---

## Files Created

### Backend (8 files)

| File | Purpose |
|------|---------|
| `backend/models/ReportHistory.js` | Tracks every generated/downloaded/emailed report |
| `backend/services/reportService.js` | All aggregation queries across 7+ collections |
| `backend/utils/pdfGenerator.js` | Professional PDF using pdfkit (student + batch reports) |
| `backend/utils/excelGenerator.js` | Multi-sheet Excel using xlsx |
| `backend/utils/emailService.js` | Nodemailer-based email with PDF attachment |
| `backend/controllers/reportController.js` | 14 handlers for all report types |
| `backend/routes/report.js` | Route definitions at `/api/reports/*` |
| `backend/reports/` (auto-created) | Not created — reports are streamed, not saved to disk |

### Frontend (6 files)

| File | Purpose |
|------|---------|
| `frontend/src/pages/admin/ReportsModule.jsx` | Main reports dashboard with 4 tabs + filters + tables |
| `frontend/src/components/admin/reports/ReportCard.jsx` | Reusable stat card with icon, value, subtext |
| `frontend/src/components/admin/reports/ReportFilters.jsx` | Filter bar with search, department, year, company, date range |
| `frontend/src/components/admin/reports/StudentReportView.jsx` | Full student report view with profile, tests, AI data, downloads |
| `frontend/src/components/admin/reports/SectionWiseReport.jsx` | Section-wise marks table (correct/wrong/skipped/percentage) |
| `frontend/src/components/admin/reports/AIReportCard.jsx` | AI evaluation display (readiness bars, company match, feedback) |

### Files Modified (3 files)

| File | Change |
|------|--------|
| `server.js` | Added `import reportRoutes` + `app.use("/api/reports", reportRoutes)` |
| `frontend/src/routes/AppRoutes.jsx` | Added `<Route path="/admin/reports" element={<ReportsModule />} />` |
| `frontend/src/layouts/AdminLayout.jsx` | Added `FileText` import + `Reports` nav item |

---

## API Endpoints (`/api/reports/*`, all admin-only)

### Student Reports
| Method | Path | Description |
|--------|------|-------------|
| GET | `/student/:studentId` | Full JSON report (profile, tests, AI, practice, interviews) |
| GET | `/student/:studentId/pdf` | Download professional PDF |
| GET | `/student/:studentId/csv` | Download section-wise CSV |
| POST | `/student/:studentId/email` | Email PDF to student's registered email |

### Batch Reports
| GET | `/batch?department=X&year=Y` | Department/year batch report with stats + top 10 |
| GET | `/batch/pdf?department=X&year=Y` | Download batch PDF |

### Company Reports
| GET | `/company/:companyId` | Company report with student scores + selection readiness |

### Practice Reports
| GET | `/practice` | Practice interview stats (company-wise, attempts, scores) |

### Exports
| GET | `/export/csv?department=X&year=Y` | Export all students CSV |
| GET | `/export/excel?department=X&year=Y` | Export all students Excel (1 sheet) |
| GET | `/export/full-excel?department=X&year=Y` | Full Excel with 3 sheets (summary, sections, practice) |

### Search & History
| GET | `/search?q=X&department=Y&year=Z` | Search students with filters + pagination |
| GET | `/history` | Last 50 generated reports |
| GET | `/companies/list` | Distinct company IDs from tests |

---

## Database Usage

**No new collections.** All data is read from existing collections:

| Collection | Used For |
|------------|----------|
| `User` | Student profile, skills, ATS score, resume info |
| `TestResult` | Section scores, percentage, grade, pass/fail |
| `AIEvaluation` | AI feedback, readiness, company match, resume match |
| `Test` | Test title, type, company mapping |
| `Interview` | Practice/real interview tracking |
| `Result` | Interview scores |
| `TestAssignment` | Student-test assignment tracking |
| `ReportHistory` | (new model) Report generation audit trail |

---

## Manual Configuration

### SMTP (Email Reports)

To enable email reports, add to your `.env` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

If SMTP is not configured, the email endpoint returns `{ simulated: true }` instead of throwing an error.

### No Other Configuration Required

PDF, CSV, and Excel exports work out-of-the-box using `pdfkit` and `xlsx` (both already in `package.json`).

---

## Testing Guide

### Backend Testing

Start the server and verify all routes respond:

```bash
# Check that routes are mounted
curl -H "Authorization: Bearer <admin-token>" http://localhost:5000/api/reports/companies/list

# Get a student report (replace with real student ID)
curl -H "Authorization: Bearer <admin-token>" http://localhost:5000/api/reports/student/<studentId>

# Download student PDF (opens in browser)
curl -H "Authorization: Bearer <admin-token>" http://localhost:5000/api/reports/student/<studentId>/pdf -o report.pdf

# Get batch report
curl -H "Authorization: Bearer <admin-token>" "http://localhost:5000/api/reports/batch?department=Computer%20Science&year=Third%20Year"

# Export all as CSV
curl -H "Authorization: Bearer <admin-token>" http://localhost:5000/api/reports/export/csv -o export.csv
```

### Frontend Testing

1. Log in as admin
2. Click "Reports" in the sidebar
3. Verify 4 tabs: Student Reports, Batch Reports, Company Reports, Practice Reports
4. **Student Reports**: Use filters, click "Generate Report", click "View" on any student, verify profile + test results + AI data + download buttons
5. **Batch Reports**: Select department/year, generate, verify stats cards + top students table
6. **Company Reports**: Select a company, generate, verify student list
7. **Practice Reports**: Click tab, verify company-wise stats load automatically
8. **Downloads**: Test PDF, CSV, Excel, Print buttons
9. **Email**: Test email button (requires SMTP config)

---

## Future Improvements

1. **Caching**: Cache frequently-generated batch/company reports in Redis or memory (30s TTL)
2. **Scheduled Reports**: Cron job to auto-generate weekly department reports and email to admins
3. **Report Comparison**: Side-by-side comparison of two students or two tests
4. **Chart Integration**: Replace stat cards with recharts/chart.js bar charts for trends
5. **Batch PDF**: Generate single PDF containing all students in a department (currently JSON-only for batch, PDF for individual)
6. **Student Self-Service**: Allow students to download their own reports from their dashboard
7. **Watermarking**: Add "Confidential" watermark to PDFs
8. **Large Dataset Pagination**: Add server-side pagination for company reports with 1000+ students
9. **Report Templates**: Let admin choose what sections to include in PDF (checkboxes before download)
10. **Webhook**: Notify students via webhook when a new report is generated
