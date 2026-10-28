# Students Attendance Tracker

A beginner-friendly, full-stack attendance management application for college classrooms. Teachers record daily attendance, administrators manage accounts/classes/enrollments, and students view their own attendance percentages and recent history.

## 1. Problem and objectives

Paper registers and disconnected spreadsheets make attendance slow to calculate and difficult to audit. This application stores attendance in Supabase PostgreSQL and provides role-specific web dashboards.

Objectives:
- Record Present/Absent for enrolled students by class and date.
- Prevent duplicate records for the same student, class, and date.
- Calculate student attendance percentages from stored records.
- Give administrators, teachers, and students different permissions.
- Demonstrate frontend, REST API, relational database, validation, and Git workflows.

## 2. Roles and implemented features

- **Administrator:** create teacher/student accounts, reset non-admin passwords, create/delete classes, enroll students, review people/classes.
- **Teacher:** view assigned classes, load a date's register, mark attendance, update previously saved attendance for their assigned class.
- **Student:** view attendance by class, overall percentage, recent records, and classes below the default 75% threshold.
- **All roles:** login/logout, friendly errors, responsive layout.

Not included in this MVP: self-registration, forgot-password email, leave approval, biometric/RFID, timetable, CSV/PDF export, multiple sessions per day, and Supabase Auth. The application intentionally uses a small custom password login stored in `app_users`; passwords are bcrypt-hashed.

## 3. Technology stack

- HTML5, CSS3, Vanilla JavaScript
- Node.js (20 or newer recommended), Express 5
- Supabase PostgreSQL
- `@supabase/supabase-js`, `bcryptjs`, `jsonwebtoken`, `cookie-parser`, `dotenv`, `express-rate-limit`, `helmet`
- Git and GitHub

No paid service or external API is required. Supabase offers a hosted database plan; availability and limits depend on its current plan.

## 4. Folder structure

```text
students-attendance-tracker/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── admin.js
│   │   ├── auth.js
│   │   ├── student.js
│   │   └── teacher.js
│   ├── utils/
│   │   └── errors.js
│   ├── server.js
│   ├── supabase.js
│   ├── package.json
│   ├── .env.example
│   ├── .gitignore
│   └── .env                 # create locally; never commit
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

`npm install` creates `backend/package-lock.json`. Commit that generated lock file so installs can be reproduced.

## 5. Prerequisites and installation links

- Visual Studio Code: https://code.visualstudio.com/
- Node.js LTS: https://nodejs.org/
- Git: https://git-scm.com/downloads
- Supabase: https://supabase.com/

In a Windows PowerShell terminal, verify:

```powershell
node --version
npm --version
git --version
```

Use Node.js 20+ (LTS is recommended). Restart VS Code after installing Node/Git if a command is not found.

## 6. Supabase setup

1. Create a Supabase account and a new project at https://supabase.com/.
2. Choose a strong database password and save it privately. This app connects through the Supabase HTTPS API; it does not need the direct database password.
3. Open **SQL Editor** in the Supabase dashboard.
4. Open `database/schema.sql` in VS Code, copy all of it, paste into the SQL Editor, and run it.
5. Open **Table Editor** and confirm `app_users`, `classes`, `enrollments`, and `attendance_records` exist.
6. Open **Project Settings → API** (dashboard labels can change). Copy the project URL and the server-side service-role/secret key. Store the privileged key only in `backend/.env`. Never place it in `frontend/`, GitHub, screenshots, or shared reports.

This implementation uses a custom `app_users` table for login rather than Supabase Auth. The service-role key bypasses PostgreSQL RLS, so Express must perform every authorization check. RLS is enabled as defense in depth; no browser-facing policies are created.

## 7. Environment configuration

From the project root:

```powershell
Copy-Item backend/.env.example backend/.env
```

Edit `backend/.env` with your own values:

```dotenv
PORT=3000
NODE_ENV=development
APP_ORIGIN=http://localhost:3000
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=PASTE_YOUR_SERVER_ONLY_KEY_HERE
JWT_SECRET=PASTE_A_RANDOM_SECRET_HERE
SESSION_COOKIE_NAME=attendance_session
ATTENDANCE_THRESHOLD=75
BOOTSTRAP_ADMIN_EMAIL=admin@example.edu
BOOTSTRAP_ADMIN_PASSWORD=Choose-A-Strong-Temporary-Password-123!
```

The values above are examples, not working credentials. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must belong to your project. `JWT_SECRET` must be at least 32 characters and random. Generate one with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the generated output into `JWT_SECRET`. Set a valid administrator email and a unique password of at least 12 characters in the bootstrap settings. On first server startup, the server creates this admin account if it does not already exist. It will not overwrite an existing account or update an existing password. Remove or change the bootstrap password in the local `.env` after initial setup; keep `.env` private.

- `.env`: local secrets and configuration; ignored by Git.
- `.env.example`: names and safe placeholders; committed to Git.

## 8. Install dependencies and run

From the project root:

```powershell
cd backend
npm install
npm run check
npm start
```

Expected terminal message: `Students Attendance Tracker running at http://localhost:3000`. On the first run, the bootstrap administrator creation message should also appear. Keep the terminal open.

Open http://localhost:3000. Sign in with `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` from your local `.env`. The health endpoint is http://localhost:3000/api/health and should return JSON with `"status":"ok"`.

For automatic restarts while developing, use `npm run dev`. Stop the server with Ctrl+C.

## 9. Architecture and workflows

```text
Browser (HTML/CSS/Vanilla JS)
        | fetch('/api/...')
        v
Express server (JWT cookie, validation, role checks)
        | server-only Supabase client
        v
Supabase PostgreSQL (constraints, indexes, RLS enabled)
```

1. Admin signs in and creates teacher/student accounts.
2. Admin creates a class and optionally assigns a teacher.
3. Admin enrolls students in the class.
4. Assigned teacher selects a class, chooses a date, marks Present/Absent, and saves.
5. Student signs in to view percentages and recent records.

Attendance percentage = (number of Present records ÷ total marked records) × 100. Unmarked dates are not counted as absences.

## 10. REST API reference

All JSON responses use the `application/json` content type. Error responses have the form `{"error":"Human-readable message"}`. UUIDs are generated by PostgreSQL. All write routes are protected by server authentication and role checks.

| Method | Path | Purpose | Access |
|---|---|---|---|
| GET | `/api/health` | Health check | Public |
| POST | `/api/auth/login` | Sign in; sets HttpOnly session cookie | Public, rate-limited |
| GET | `/api/auth/me` | Current profile | Signed in |
| POST | `/api/auth/logout` | Clear session cookie | Public |
| GET | `/api/admin/overview` | List active users, classes, counts | Admin |
| POST | `/api/admin/users` | Create teacher/student | Admin |
| PATCH | `/api/admin/users/:id/password` | Reset a non-admin password | Admin |
| DELETE | `/api/admin/users/:id` | Delete a non-admin account | Admin |
| POST | `/api/admin/classes` | Create class | Admin |
| DELETE | `/api/admin/classes/:id` | Delete class and related records | Admin |
| POST | `/api/admin/classes/:id/enrollments` | Enroll a student | Admin |
| GET | `/api/teacher/classes` | List assigned classes | Teacher |
| GET | `/api/teacher/classes/:id/attendance?date=YYYY-MM-DD` | Load class register | Assigned teacher |
| PUT | `/api/teacher/classes/:id/attendance` | Save/update attendance records | Assigned teacher |
| GET | `/api/student/summary` | Own class percentages and recent records | Student |

Request examples:

Create a student (admin cookie required):
```json
{
  "name": "Demo Student",
  "email": "student@example.edu",
  "role": "student",
  "password": "Temporary-Password-123",
  "student_number": "STU001",
  "department": "Computing"
}
```

Save attendance (assigned teacher cookie required):
```json
{
  "date": "2026-10-27",
  "records": [
    {"student_id": "REPLACE_WITH_STUDENT_UUID", "status": "Present"},
    {"student_id": "REPLACE_WITH_ANOTHER_STUDENT_UUID", "status": "Absent"}
  ]
}
```

## 11. Security notes

- Passwords are hashed with bcrypt; raw passwords are never stored.
- Sessions are signed JWTs in HttpOnly, SameSite=Strict cookies, with an eight-hour expiry. Cookies are `Secure` in production.
- Login is rate-limited; Helmet sets security headers; JSON request bodies are size-limited.
- Role checks happen on the server. Teacher class IDs are checked against the authenticated teacher; student queries use the authenticated student's ID, not a browser-supplied ID.
- PostgreSQL constraints prevent duplicate enrollments and duplicate attendance for a class/student/date.
- The service-role key bypasses RLS; keep it on the server and do not add public policies.
- For a real deployment, use HTTPS, rotate secrets, add monitored audit logs, review backup/retention policy, and consider Supabase Auth or a hardened session store. This educational app is not a substitute for an institutional security review.

## 12. Manual testing checklist

1. `GET /api/health` returns status `ok`.
2. Wrong password returns 401 and does not log in.
3. Admin can create a teacher and a student with unique email addresses.
4. Duplicate email/student number returns a readable conflict error.
5. Admin creates a class, assigns a teacher, and enrolls a student.
6. Enrolling the same student twice returns a conflict error.
7. Teacher can see only assigned classes; trying to access another teacher's class returns 404.
8. Teacher marks a date and saves; reloading the date shows the saved status.
9. Saving again updates the same record rather than creating a duplicate.
10. A future date, invalid status, duplicate student in one request, or un-enrolled student is rejected.
11. Student dashboard percentage matches present ÷ total marked × 100.
12. A student cannot access admin or teacher routes (403).
13. A request without a valid session to private routes returns 401.
14. Student dashboard shows only that student's records.
15. Empty classes and students display helpful empty states.
16. Test at desktop width and a narrow mobile viewport.
17. Delete a class only after confirming that its attendance and enrollments will be deleted.

Run syntax checks with `npm run check`. `npm test` runs Node's test runner; no automated integration tests are included in this MVP. A real Supabase connection must be verified using your own credentials and the health/feature tests above.

## 13. Troubleshooting

- **`node` or `npm` not recognized:** install Node.js LTS, restart the terminal, and rerun version checks.
- **`git` not recognized:** install Git for Windows and restart the terminal.
- **Missing environment variable:** check spelling in `backend/.env`; do not add quotes unless needed.
- **Supabase connection errors:** verify project URL/key, internet access, project status, and SQL schema. The health endpoint checks Express only, not Supabase.
- **`relation does not exist`:** run `database/schema.sql` in the correct Supabase project.
- **Login fails:** verify the bootstrap credentials and server logs; check that `app_users` exists. The bootstrap account is created only if the email does not already exist.
- **Port already in use:** change `PORT` in `.env` (for example to 3001) and update `APP_ORIGIN` to `http://localhost:3001`.
- **CORS/origin error:** open the frontend through the Express URL, not by double-clicking `index.html`; ensure `APP_ORIGIN` matches the browser origin.
- **403 permission error:** confirm the account role and class assignment.
- **Duplicate record error:** the database uniqueness constraints are working; check whether the record already exists.
- **Blank dashboard/API error:** inspect the browser DevTools Network tab and the backend terminal; do not paste secret keys into issue reports.

## 14. GitHub upload

Create an empty repository on https://github.com/new. From the project root (not inside `backend`):

```powershell
git init
git status
git add .
git status
git commit -m "Build Students Attendance Tracker"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your own repository URL. Before `git add .`, confirm `backend/.env` and `node_modules/` are ignored. `backend/.env.example` should be included. The first `git status` after staging should not list secrets. If a secret was already committed, `.gitignore` does not remove it: rotate it immediately and remove it from repository history.

## 15. Future improvements

- Supabase Auth and password-reset flow.
- Audit history and teacher edit windows.
- Export reports to CSV/PDF.
- More detailed analytics and configurable attendance thresholds.
- Multiple lecture sessions per day and leave/late statuses.
- Automated integration tests and deployment pipeline.

## 16. License / educational use

This project is intended for learning and college demonstration. Obtain permission before using real student information, and follow your institution's data-protection rules.
