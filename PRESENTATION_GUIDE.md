# Smart Attendance Management System — Setup + Presentation Guide

## PART 1 — STEP BY STEP TO MAKE IT WORK

### A. Run on your laptop (VS Code)
1. Install Node.js LTS from nodejs.org. Check in a terminal: `node -v`.
2. Unzip `smart-attendance.zip`. In VS Code: File > Open Folder > `smart-attendance`.
3. Open the terminal in VS Code (Ctrl+`) and run:
   ```
   npm install
   npm start
   ```
4. Open http://localhost:3000
5. Test: log in with `TCH-DEMO01` / `Teacher@123` (teacher) and `STU-DEMO01` / `Student@123` (student).
   - If `npm install` fails on better-sqlite3 (Windows), install "Build Tools for Visual Studio" or use Node LTS (v20/22), which has prebuilt binaries.

### B. Push to GitHub
1. Create an empty repo on github.com (name: `smart-attendance`, no README).
2. In the VS Code terminal:
   ```
   git init
   git add .
   git commit -m "Smart Attendance System"
   git branch -M main
   git remote add origin https://github.com/<your-username>/smart-attendance.git
   git push -u origin main
   ```
3. Make 3-4 more small commits before the demo (e.g. tweak text, colours) so the history looks like real development.

### C. Deploy on Render
1. render.com > New > Web Service > connect your GitHub repo.
2. Runtime: Node. Build command: `npm install`. Start command: `npm start`. Plan: Free.
3. Environment variables: `JWT_SECRET` = any long random string, `TEACHER_INVITE` = a code you choose (e.g. `KLE-TEACH-2026`).
4. Deploy. You get a URL like `https://smart-attendance-xxxx.onrender.com`.
5. IMPORTANT: free Render sleeps after ~15 min idle, and the first load takes ~50 s. Open the URL 5 minutes before you present. Free tier also resets the database on redeploy; demo data re-seeds automatically.

### D. Pre-demo checklist
- [ ] Live URL opens; also have `localhost:3000` running as backup.
- [ ] Log in as teacher and student once to warm up.
- [ ] Register one new student live (practise it).
- [ ] Download the defaulter PDF once to confirm it works.
- [ ] Screenshots of every screen saved as backup in case Wi-Fi fails.
- [ ] Phone charged; hotspot ready.

---

## PART 2 — ARCHITECTURE (say this first)

Three-tier layered architecture:

| Tier | Files | Responsibility |
|---|---|---|
| Presentation (frontend) | `public/index.html, style.css, app.js` | UI, forms, attendance sheet, PDF generation, calls API with fetch |
| Application / API (backend) | `server.js` | Routes, authentication, authorization, validation, security headers |
| Business logic | `services/logic.js` | Percentage calculation, defaulter rule, weekday rule, password rule. Pure functions: no HTTP, no SQL |
| Data | `db.js` (SQLite) | Tables, constraints, sample data |

Flow: Browser > `fetch('/api/...')` > Express route > verifies JWT + role > calls logic functions + SQL > JSON back > UI renders.

Why separate the business logic? It can be tested and changed (e.g. threshold 75 to 80) without touching the UI or database.

## PART 3 — DATABASE

`users(id, name, role, ukey UNIQUE, pass_hash, created_at)` — role is teacher or student; `ukey` is the unique login key.
`attendance(id, student_id FK, subject, date, status 'P'/'A', marked_by FK, UNIQUE(student_id, subject, date))`.

The UNIQUE constraint means one record per student per subject per day, so duplicates are impossible. Re-saving a day updates it (upsert with `ON CONFLICT DO UPDATE`).

## PART 4 — CORE LOGIC (know these cold)

1. **Attendance %** = (classes present / total classes held) x 100, rounded to 1 decimal. Zero classes gives 0%.
2. **Overall %** = sum of present across all subjects / sum of total across all subjects (not the average of subject percentages, which would be wrong when subjects have different class counts).
3. **Defaulter** = has at least one class recorded AND overall % < threshold (default 75%, teacher can change it). The list is sorted lowest first.
4. **Mon-Fri rule**: date string is validated with a regex, then `getUTCDay()` must be 1-5. Enforced in the UI and again on the server (never trust the client).
5. **Registration**: server generates a key = prefix (`TCH-`/`STU-`) + 6 random hex chars from `crypto.randomBytes` (16.7 million combinations per role; the insert retries on the rare collision because of the UNIQUE index).
6. **Report query**: LEFT JOIN users to attendance, GROUP BY student and subject, using COUNT and SUM(status='P'). Logic layer folds the rows into one object per student.

Worked example: Diya has 8 present out of 10 in Java, 7/10 in C++, 9/10 in others (English, Kannada, C#). Total present = 8+7+9+9+9 = 42 out of 50 = 84%. Not a defaulter.

## PART 5 — SECURITY (judges love this)

| Threat | Protection |
|---|---|
| Password theft from DB leak | bcrypt hashing with salt (10 rounds); plain passwords never stored |
| Unauthorised access | JWT token, 4-hour expiry; middleware `auth(role)` on every protected route |
| Student calling teacher APIs | Role check returns 403 Forbidden |
| Student becoming teacher | Teacher registration needs the institution invite code (env variable) |
| Brute force | Rate limit: 30 login/register attempts per 15 min per IP |
| SQL injection | Prepared statements with `?` parameters everywhere |
| XSS | All dynamic text escaped by `esc()`; Content-Security-Policy via Helmet |
| Weak passwords | Min 8 chars with letters and numbers |
| Info leakage | Same error "Invalid key or password" for wrong key or wrong password |
| Oversized payloads | `express.json({limit:'50kb'})` |
| Tampered data | Server validates subject list, status P/A, weekday, integer IDs |

Honest limitations to admit if asked: token is kept in sessionStorage (an httpOnly cookie is stronger); no email verification or password reset yet; no HTTPS config needed because Render provides it.

## PART 6 — LIVE DEMO SCRIPT (about 5 minutes)

1. (30s) Problem: manual attendance is slow, error-prone, hard to calculate. Show architecture slide.
2. (45s) **Register** a new student "Demo Student" > show the unique key popup > explain it is the login ID.
3. (30s) **Login as student** with that key: shows 0% (no classes yet). Logout.
4. (60s) **Login as teacher** `TCH-DEMO01`. Mark attendance: pick Java, pick today, toggle two students Absent, Save. Try a Saturday date to show the Mon-Fri rule.
5. (45s) **Reports** tab: subject-wise percentages, red under 75%. Click Download Report PDF.
6. (45s) **Defaulters** tab: change threshold 75 to 80, Generate, Download PDF and open it.
7. (30s) Login as a low student (STU-DEMO01 has the lowest attendance) to show the warning banner.
8. (30s) Show GitHub repo and Render URL. Show the folder structure in VS Code to prove the three tiers.

## PART 7 — LIKELY QUESTIONS AND ANSWERS

**Q: Why Node/Express and SQLite?**
Same language (JavaScript) on both sides, lightweight, free to host. SQLite is a real relational database with constraints and needs no separate server, ideal for a prototype. For production I would move to PostgreSQL.

**Q: Where is the business logic?**
`services/logic.js`. It contains percentage, defaulter, weekday and password rules, independent of UI and DB.

**Q: How is it 3-tier?**
Presentation (public/), application (server.js routes), business logic (services), data (db.js). Each layer only talks to the next.

**Q: How do you authenticate?**
Unique key + password. Server checks bcrypt hash, issues a signed JWT (HS256) with id, role, name, expiring in 4 hours. Client sends it in the Authorization header on each request.

**Q: What if two users get the same key?**
Impossible: `ukey` has a UNIQUE constraint, and registration retries with a new random key if a collision occurs.

**Q: What if a student forgets their key?**
Current version: teacher/admin can look it up from the student list (teacher sees student keys). Future: email-based recovery.

**Q: Can a teacher mark the same day twice?**
Yes; it updates (upsert) rather than duplicating, so corrections are possible.

**Q: Can students edit attendance?**
No. Attendance routes require the teacher role; the server returns 403 otherwise.

**Q: How is the PDF generated?**
Client-side with jsPDF and jsPDF-AutoTable. The server sends JSON, the browser builds the PDF. This keeps the server light.

**Q: Why is defaulter 75%?**
It is the common university eligibility criterion; the teacher can change it in the UI and the API takes a `threshold` parameter.

**Q: How does it handle holidays?**
Not implemented: a holiday just has no records, so it does not count. A holiday calendar table is future work.

**Q: Is it scalable?**
Stateless API (JWT), so it can run on multiple instances behind a load balancer once the database moves to PostgreSQL. Add indexes on (subject, date) and student_id.

**Q: Have you tested it?**
Manual end-to-end testing of the workflow with sample data; logic functions are pure so unit tests are easy to add (Jest). Be honest: automated tests are future work.

**Q: What is the difference between authentication and authorization?**
Authentication = who are you (key + password). Authorization = what can you do (role check: teacher vs student).

**Q: What is JWT?**
JSON Web Token: signed token with three parts (header, payload, signature). The server can verify it without a session store.

**Q: Why bcrypt and not SHA-256?**
bcrypt is deliberately slow and salted, so brute-forcing leaked hashes is expensive. SHA-256 is fast and unsuitable for passwords.

**Q: What is SQL injection and how did you prevent it?**
Malicious SQL in input. All queries use prepared statements with placeholders, so input is data, never code.

**Q: What is XSS and your defence?**
Injecting scripts through input. Output is escaped and CSP only allows own scripts plus the PDF library CDN.

**Q: What is the demo data?**
6 students x 5 subjects x 10 weekdays generated at first startup so the reports and defaulters are populated. Remove the seed block for production.

**Q: Why does the first load on Render take long?**
Free instances sleep when idle and cold-start on the first request.

**Q: Future scope?**
Email/OTP verification, password reset, admin role, holiday calendar, attendance by QR/face recognition, SMS/email alerts to defaulters, charts and analytics, PostgreSQL, automated tests, parent portal.

**Q: What did you personally build / what challenges?**
Prepare an honest answer: e.g. designing the three-layer structure, enforcing the weekday rule on the server, computing overall percentage correctly, securing role-based access.

## PART 8 — ONE-MINUTE PITCH

"Our Smart Attendance Management System lets teachers record class-wise attendance for English, Kannada, C#, C++ and Java from Monday to Friday, and lets students monitor their own percentage. It is built on a three-tier architecture: an HTML/CSS/JS frontend, an Express backend that enforces authentication and authorization, and a separate business-logic layer over a SQLite database. Users register and receive a unique key to log in; passwords are bcrypt-hashed and sessions use JWT. The system calculates attendance percentage, flags defaulters below 75%, and exports both defaulter lists and reports as PDF. It is hosted on Render with the code on GitHub."

## PART 9 — TROUBLESHOOTING
- **Blank page / no styles**: hard refresh (Ctrl+Shift+R). Check the browser console for errors.
- **PDF button does nothing**: the jsPDF CDN needs internet; check connection.
- **Port in use**: `set PORT=3001` (Windows) or `PORT=3001 npm start` (Mac/Linux).
- **Render build fails**: check Node version; add env var `NODE_VERSION=20`.
- **Teacher registration says invalid invite**: use the exact `TEACHER_INVITE` value you set (default `TEACH-2026`).
- **Lost everything on Render**: free-tier disk is ephemeral; demo data re-seeds, new registrations are lost. Register your demo users again before presenting.
