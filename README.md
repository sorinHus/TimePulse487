# TimePulse487 — HR Management SaaS App

> **Status: Feature-complete · Live on Railway + Cloudflare Pages**

A full-stack HR management SaaS application for employee attendance tracking, leave management, and workforce reporting. Built with Django 5 + DRF on the backend and React + Vite on the frontend.

🔗 **Live:** https://timepulse487.pages.dev

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
| Deploy | Railway (backend) · Cloudflare Pages (frontend) |

---

## Features

### Attendance
- Daily check-in / check-out with timestamps and automatic hours calculation
- Today's attendance status per employee
- Monthly attendance history with navigation
- Team attendance overview (admin / manager)

### Leave Management
- 14 leave types (Annual, Sick, Maternity, Paternity, Unpaid, and more)
- Leave balance tracking per employee per year
- Leave request submission with date range and type
- Cancel own pending request

### Approval Workflow
- Hierarchical: Employee → Manager → Admin
- Approve / reject with dedicated endpoints
- Leave request status tracking (pending / approved / rejected / cancelled)

### Dashboards (role-based)
- **Employee** — check-in/out widget, personal stats, attendance history
- **Manager** — team overview, tabbed view: attendance / leaves / team members
- **Admin** — KPI cards, department breakdown, all-employees tabs

### Team & Calendar
- Monthly team calendar — dot indicators per day, detail panel on click
- Team page — grid / list view of team members with filters (name, department, role)

### Reports & Export
- Excel export — monthly attendance report (openpyxl)
- PDF export — monthly leave report (ReportLab)

### Admin
- User management — create, activate/deactivate users
- Department listing
- Role-based access control (admin / manager / employee)

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
```

**Auth flow:** `POST /api/auth/login/` returns JWT pair → stored in localStorage → Axios interceptor attaches `Authorization: Bearer` to every request → auto-refresh on 401 → `POST /api/auth/logout/` blacklists refresh token.

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
| GET/PATCH | `/api/users/<id>/` | User detail / edit (admin only) |
| GET | `/api/departments/` | List departments |

### Attendance
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/attendance/check-in/` | Check in |
| POST | `/api/attendance/check-out/` | Check out + calculate hours |
| GET | `/api/attendance/today/` | Today's attendance |
| GET | `/api/attendance/history/` | Monthly history |
| GET | `/api/attendance/team/` | Team attendance (admin/manager) |

### Leaves
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/leaves/types/` | Leave types |
| GET | `/api/leaves/balance/?year=YYYY` | Leave balance (year required) |
| GET/POST | `/api/leaves/requests/` | List / create requests |
| GET/DELETE | `/api/leaves/requests/<id>/` | Detail / cancel |
| POST | `/api/leaves/requests/<id>/approve/` | Approve |
| POST | `/api/leaves/requests/<id>/reject/` | Reject |

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
├── attendance/             # CheckIn / CheckOut models + views
├── leaves/                 # LeaveType, LeaveBalance, LeaveRequest
├── reports/                # Calendar, export, dashboard views
├── init_db.py              # Seed superuser (runs on every Railway deploy)
├── seed_data.py            # Seed departments + users
├── seed_leaves.py          # Seed leave types + balances
└── frontend/
    └── src/
        ├── api/
        │   ├── axios.js            # Axios instance + JWT interceptors
        │   ├── auth.js             # login, logout, getMe
        │   ├── attendence.js       # checkIn, checkOut, history
        │   ├── leaves.js           # leave CRUD + approve/reject
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
        │   ├── Leaves.jsx
        │   ├── Calendar.jsx
        │   ├── Reports.jsx
        │   ├── Team.jsx
        │   └── Admin.jsx
        └── context/
            └── AuthContext.jsx
```

---

## User Roles

| Role | Access |
|---|---|
| `admin` | Full access — all employees, user management, all dashboards |
| `manager` | Own team — attendance, leaves, approvals for their department |
| `employee` | Own data — check-in/out, leave requests, personal calendar |

---

## Test Accounts

| Username | Password | Role |
|---|---|---|
| `sorin487` | Admin2026! | Admin / Superuser |
| `director.general` | Director2026! | Manager |
| `maria.pop` | Manager2026! | Manager |
| `nicoleta.barbu` | Manager2026! | Manager |
| *(any employee)* | Angajat2026! | Employee |

---

## Development Status

| Task | Description | Status |
|---|---|---|
| T01 | Project setup | ✅ Done |
| T02 | User & Department models | ✅ Done |
| T03 | JWT authentication | ✅ Done |
| T04 | Check-in / Check-out | ✅ Done |
| T05 | Leave types & balance | ✅ Done |
| T06 | Leave requests + approval workflow | ✅ Done |
| T08 | Team calendar | ✅ Done |
| T09 | Excel export | ✅ Done |
| T10 | PDF export | ✅ Done |
| T11 | Admin dashboard | ✅ Done |
| T12 | Manager dashboard | ✅ Done |
| T13 | Employee dashboard | ✅ Done |
| T14 | React frontend (all pages) | ✅ Done |
| T15 | Deploy — Railway + Cloudflare Pages | ✅ Done |
| T07 | Email notifications | ⏳ Planned |

---

## Backlog

| ID | Description |
|---|---|
| B01 | Mandatory substitute field on leave request |
| B02 | Substitute inherits permissions during leave period |
| B03 | Auto-return of annual leave days overlapping priority leave (sick, bereavement) |
| B04 | Extra annual leave days based on seniority |
| B05 | Leave day expiry after 18 months + employee notifications |
| B06 | Mandatory annual leave planning window (Dec 1 — Jan 31) |
| B07 | Working days calculation excluding weekends + Romanian public holidays via `https://zilelibere.webventure.ro/api/[yyyy]` |
| B08 | Sidebar: show full name (First + Last) instead of first name only |
| B09 | Reject leave: manager must provide a mandatory reason (modal with required text field) |
| B10 | Auto-approve leave if manager takes no action before `start_date` |
| B11 | Sidebar: pending leave badge on Leaves nav item (manager/admin only) |
| B12 | Calendar: show approved leave periods for all department members |

---

## Related Projects

- **[MED487](https://github.com/sorinHus/med487)** — Medical practice management app (same stack, production-deployed)
- **[MRU_Tracker](https://github.com/sorinHus/MRU_Tracker)** — Multi-user HR file tracking tool

---

## License

Private project — all rights reserved.