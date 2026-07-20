# HCM487 — HR Management SaaS

> **Status: Active development · Live on Railway + Cloudflare Pages**

A full-stack HR management SaaS application for employee attendance tracking, leave management, and workforce reporting. Built with Django 5 + DRF on the backend and React + Vite on the frontend.

🔗 **Live:** https://timepulse487.pages.dev  
📱 **Mobile:** https://timepulse487.pages.dev/m

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python · Django 5 · Django REST Framework |
| Database | PostgreSQL |
| Authentication | JWT (djangorestframework-simplejwt + token blacklist) |
| Frontend | React · Vite · React Router · CSS Modules |
| State / Data | AuthContext · Axios (JWT interceptor + auto-refresh) |
| Excel export | openpyxl |
| PDF export | ReportLab |
| Scheduled jobs | Railway Cron (expire leave balances, auto clock-out) |
| Deploy | Railway (backend) · Cloudflare Pages (frontend) |

---

## Features

### Attendance
- Multiple clock-in / clock-out sessions per day with automatic hours calculation
- Night hours tracking (22:00–06:00) with visual indicator
- Day status: **Complete** / **In progress** / **Incomplete** / **Absent**
- Monthly attendance history with session drill-down
- Clock-in blocked during approved leave (banner + disabled button)
- Overtime detection with request + approval workflow
- Team attendance overview (admin / manager)
- **Admin: Bulk Clock-In / Clock-Out** for all active employees

### Leave Management
- Multiple leave types (Annual, Sick, Maternity, Paternity, Unpaid, and more)
- Leave balance tracking per employee per year with expiry date
- **Annual leave expires July 1 of year+2** (18-month rule) — daily cron job
- Leave request submission with working-days calculation (excluding weekends + Romanian public holidays)
- Cancel own pending request
- **Register Sick Leave** on behalf of an employee (manager / admin) with overlap resolution (return days or extend leave)
- In-app notifications for approvals, rejections, and leave events

### Annual Leave Planning (B17)
- Employees propose a month-by-month annual leave plan for the current year
- Draft → Submit → Approve / Reject workflow
- Carryover days from previous year displayed with expiry date
- Seniority-based entitlement calculated as of December 31 of the planning year
- Managers view and review team plans from the Team page

### Approval Workflow
- Hierarchical: Employee → Manager → Admin
- Approve / reject with optional note
- Status tracking: pending / approved / rejected / cancelled

### Dashboards (role-based)
- **Employee** — clock-in/out widget, personal stats, leave balance summary
- **Manager** — team overview, tabbed view: attendance / leaves / team members
- **Admin** — KPI cards, department breakdown, all-employees tabs

### Team & Calendar
- Monthly team calendar — dot indicators per day, detail panel on click
- Team page — grid / list view with filters (name, department, role)
- View annual leave plan per team member (modal, read-only for approved plans)
- Register Sick Leave for any team member directly from Team page

### Reports & Export
- Excel export — monthly attendance report (openpyxl)
- PDF export — monthly leave report (ReportLab)

### Admin
- User management — create, edit, delete users
- **Deactivate / Activate** with mandatory reason field
- Department listing
- **Bulk Clock-In / Clock-Out** for all employees (Attendance Tools tab)
- Role-based access control (admin / manager / employee)

### Mobile App (`/m`)
- Standalone mobile-optimized view, no sidebar
- Works as PWA — can be added to Home Screen on Android and iOS
- **Clock tab** — large clock-in / clock-out buttons, today's status, live pulse indicator, on-leave banner
- **Leave tab** — balance cards, new leave request form with working-days preview, pending/approved requests list
- Reuses existing JWT session; separate login screen if not authenticated
- Desktop browsers visiting the root URL are unaffected; mobile browsers auto-redirect to `/m`

### Light / Dark Mode
- Toggle button in topbar (sun/moon icon)
- Preference persisted in `localStorage`
- CSS custom properties (`--bg-main`, `--bg-card`, `--text-primary`, …) via `theme.css`
- All pages and components switch instantly without reload

---

## Architecture

```
Browser (React/Vite — Cloudflare Pages)
        |  HTTPS · JSON · JWT
        v
Django 5 + DRF (Railway)
        |  ORM
        v
PostgreSQL (Railway)
        |
Railway Cron Jobs
  • expire_leave_balances  — daily @ 01:00
  • auto_clock_out         — daily @ 23:55
```

**Auth flow:** `POST /api/auth/login/` returns JWT pair → stored in `localStorage` → Axios interceptor attaches `Authorization: Bearer` to every request → auto-refresh on 401 → `POST /api/auth/logout/` blacklists refresh token.

---

## API Endpoints

### Auth & Users
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login/` | Login → JWT pair |
| POST | `/api/auth/refresh/` | Refresh access token |
| POST | `/api/auth/logout/` | Logout (blacklist refresh token) |
| GET | `/api/auth/me/` | Current user data |
| POST | `/api/auth/register/` | Create user (admin only) |
| GET | `/api/users/` | List users (admin only) |
| GET/PATCH/DELETE | `/api/users/<id>/` | User detail / edit / delete |
| POST | `/api/users/<id>/deactivate/` | Deactivate with reason |
| POST | `/api/users/<id>/activate/` | Reactivate user |
| GET | `/api/departments/` | List departments |

### Attendance
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/attendance/clock-in/` | Start a session |
| POST | `/api/attendance/clock-out/` | Close session + calculate hours |
| GET | `/api/attendance/today-sessions/` | Today's sessions + on_leave status |
| GET | `/api/attendance/history/` | Monthly history (`?month=YYYY-MM`) |
| GET | `/api/attendance/team/` | Team attendance (admin/manager) |
| POST | `/api/attendance/admin/bulk-clock-in/` | Bulk clock-in all employees |
| POST | `/api/attendance/admin/bulk-clock-out/` | Bulk clock-out all employees |
| POST | `/api/attendance/overtime-request/` | Request overtime approval |

### Leaves
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/leaves/types/` | Leave types |
| GET | `/api/leaves/balance/?year=YYYY` | Leave balance with expiry |
| GET/POST | `/api/leaves/requests/` | List / create requests |
| DELETE | `/api/leaves/requests/<id>/` | Cancel own request |
| POST | `/api/leaves/requests/<id>/approve/` | Approve |
| POST | `/api/leaves/requests/<id>/reject/` | Reject with note |
| POST | `/api/leaves/sick-leave/register/` | Register sick leave (manager) |
| GET | `/api/leaves/working-days/?start=&end=` | Count working days |
| GET/PUT | `/api/leaves/schedule/?year=YYYY` | Get / save annual plan |
| POST | `/api/leaves/schedule/<id>/submit/` | Submit plan for review |
| POST | `/api/leaves/schedule/<id>/review/` | Approve or reject plan |
| GET | `/api/leaves/schedule/team/?year=YYYY` | Team plans (manager/admin) |

### Dashboard & Reports
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/admin/` | Admin dashboard data |
| GET | `/api/dashboard/manager/` | Manager dashboard data |
| GET | `/api/dashboard/employee/` | Employee dashboard data |
| GET | `/api/calendar/` | Monthly team calendar |
| GET | `/api/reports/attendance/export/` | Excel export |
| GET | `/api/reports/leaves/export/` | PDF export |

---

## Project Structure

```
TimePulse4/
├── timepulse487/           # Django project settings
├── accounts/               # User, Department, auth endpoints
│   └── management/commands/
├── attendance/             # AttendanceSession, OvertimeRequest
│   └── management/commands/
│       └── auto_clock_out.py
├── leaves/                 # LeaveType, LeaveBalance, LeaveRequest, LeaveSchedule
│   └── management/commands/
│       └── expire_leave_balances.py
├── reports/                # Calendar, export, dashboard views
├── init_db.py              # Seed superuser (Railway deploy hook)
├── seed_data.py            # Seed departments + users
├── seed_leaves.py          # Seed leave types + balances
└── frontend/
    └── src/
        ├── api/
        │   ├── axios.js            # Axios instance + JWT interceptors
        │   ├── auth.js             # login, logout, getMe
        │   ├── attendance.js       # clockIn, clockOut, history, overtime
        │   ├── leaves.js           # leave CRUD, approve/reject, schedule
        │   └── dashboard.js        # dashboards, calendar, exports
        ├── components/
        │   ├── Layout.jsx
        │   └── Sidebar.jsx
        ├── pages/
        │   ├── Login.jsx
        │   ├── DashboardEmployee.jsx
        │   ├── DashboardManager.jsx
        │   ├── DashboardAdmin.jsx
        │   ├── Attendance.jsx
        │   ├── Leaves.jsx          # includes annual plan (B17)
        │   ├── Calendar.jsx
        │   ├── Reports.jsx
        │   ├── Team.jsx            # includes plan review modal
        │   ├── Admin.jsx
        │   ├── Notifications.jsx
        │   └── MobileApp.jsx       # standalone mobile view (/m)
        └── context/
            └── AuthContext.jsx
```

---

## User Roles

| Role | Access |
|---|---|
| `admin` | Full access — all employees, user management, bulk actions, all dashboards |
| `manager` | Own team — attendance, leaves, approvals, sick leave registration, plan review |
| `employee` | Own data — clock-in/out, leave requests, annual plan, personal calendar |

---

## Test Accounts

| Username | Password | Role |
|---|---|---|
| `director.general` | Director2026! | Manager |
| `maria.pop` | Manager2026! | Manager |
| `rodica.chivu` | Angajat2026! | Employee |

---

## Development Status

| ID | Description | Status |
|---|---|---|
| T01 | Project setup | ✅ Done |
| T02 | User & Department models | ✅ Done |
| T03 | JWT authentication | ✅ Done |
| T04 | Clock-in / Clock-out with multiple sessions | ✅ Done |
| T05 | Leave types & balance | ✅ Done |
| T06 | Leave requests + approval workflow | ✅ Done |
| T07 | Working days (weekends + RO public holidays) | ✅ Done |
| T08 | Team calendar | ✅ Done |
| T09 | Excel export | ✅ Done |
| T10 | PDF export | ✅ Done |
| T11 | Admin dashboard | ✅ Done |
| T12 | Manager dashboard | ✅ Done |
| T13 | Employee dashboard | ✅ Done |
| T14 | React frontend (all pages) | ✅ Done |
| T15 | Deploy — Railway + Cloudflare Pages | ✅ Done |
| B04 | Seniority-based extra annual leave days | ✅ Done |
| B07 | Night hours tracking (22:00–06:00) | ✅ Done |
| B09 | Reject leave: mandatory reason (modal) | ✅ Done |
| B11 | Pending leave badge on Sidebar nav | ✅ Done |
| B12 | Calendar: approved leave for team members | ✅ Done |
| B13 | Register Sick Leave (manager, with overlap resolution) | ✅ Done |
| B14 | Overtime detection + request workflow | ✅ Done |
| B15 | In-app notifications | ✅ Done |
| B16 | Annual leave expiry after 18 months (cron + frontend) | ✅ Done |
| B17 | Annual Leave Planning — formal monthly plan module | ✅ Done |
| B18 | Admin: Delete user / Deactivate with reason / Bulk clock actions | ✅ Done |
| B19 | Attendance: clock-in blocked during approved leave | ✅ Done |
| B20 | Mobile app at `/m` (PWA-ready, clock + leave) | ✅ Done |
| B21 | Light / dark mode toggle (CSS variables, localStorage) | ✅ Done |

---

## Related Projects

- **[MED487](https://github.com/sorinHus/med487)** — Medical practice management app (same stack, production-deployed)
- **[MRU_Tracker](https://github.com/sorinHus/MRU_Tracker)** — Multi-user HR file tracking tool

---

## License

Private project — all rights reserved.
