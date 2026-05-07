# TimePulse487 — HR Management SaaS App

> **Status: Feature-complete · Deploy in progress**

A full-stack HR management SaaS application for employee attendance tracking, leave management, and workforce reporting. Built with Django 5 + DRF on the backend and React + Vite on the frontend.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python · Django 5 · Django REST Framework |
| Database | PostgreSQL |
| Authentication | JWT (djangorestframework-simplejwt + token blacklist) |
| Frontend | React · Vite · React Router · CSS Modules |
| State / Data | React Query (TanStack) · AuthContext |
| Date handling | Day.js |
| Charts | Recharts |
| HTTP client | Axios (with JWT interceptor) |
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
- Multiple leave types: Annual (21 days), Sick (30 days), Unpaid (30 days)
- Leave balance tracking per employee
- Leave request submission with date range and type
- Cancel own request

### Approval Workflow
- Hierarchical: Employee → Manager → Admin
- Approve / reject with dedicated endpoints
- Leave request status tracking

### Dashboards (role-based)
- **Employee** — check-in/out widget, personal stats, attendance history
- **Manager** — team overview, tabbed view: attendance / leaves / team members
- **Admin** — KPI cards, department breakdown, all-employees tabs

### Team & Calendar
- Monthly team calendar — dot indicators per day, detail panel on click
- Team page — grid / list view of team members with filters

### Reports & Export
- Excel export — monthly attendance report (openpyxl)
- PDF export — monthly leave report (ReportLab)

### Platform
- JWT authentication with refresh token and blacklist on logout
- Role-based routing: `admin` / `manager` / `employee`
- `AuthContext` — persists user session across page refresh
- Collapsible sidebar with role-aware navigation
- CSS Modules throughout — scoped styling per component
- Full English UI

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

**Auth flow:** `POST /api/auth/login/` returns JWT pair → stored in context → Axios interceptor attaches `Authorization: Bearer` to every request → auto-refresh on 401 → `POST /api/auth/logout/` blacklists refresh token.

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
| POST | `/api/auth/change-password/` | Change password |
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
| GET | `/api/leaves/balance/` | Leave balance |
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
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── accounts/               # User, Department, auth endpoints
├── attendance/             # CheckIn / CheckOut models + views
├── leaves/                 # LeaveType, LeaveBalance, LeaveRequest
├── reports/                # Calendar, export, dashboard views
└── frontend/
    └── src/
        ├── api/
        │   ├── axios.js            # Axios instance + JWT interceptors
        │   ├── auth.js             # login, logout, getMe
        │   ├── attendence.js       # checkIn, checkOut, history
        │   ├── leaves.js           # leave CRUD + approve/reject
        │   └── dashboard.js        # dashboards, calendar, exports
        ├── components/
        │   ├── Layout.jsx          # Shell: Sidebar + Topbar + <Outlet />
        │   └── Sidebar.jsx         # Collapsible nav, role-aware, logout
        ├── pages/
        │   ├── Login.jsx
        │   ├── DashboardEmployee.jsx
        │   ├── DashboardManager.jsx
        │   ├── DashboardAdmin.jsx
        │   ├── Attendance.jsx
        │   ├── Leaves.jsx
        │   ├── Calendar.jsx
        │   ├── Reports.jsx
        │   ├── Admin.jsx
        │   └── Team.jsx
        ├── context/
        │   └── AuthContext.jsx     # useAuth(), AuthProvider
        └── styles/
            ├── variables.css
            ├── reset.css
            └── global.css
```

---

## User Roles

| Role | Access |
|---|---|
| `admin` | Full access — all employees, user management, all dashboards |
| `manager` | Own team — attendance, leaves, approvals for their department |
| `employee` | Own data — check-in/out, leave requests, personal calendar |

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
| T15 | Deploy — Railway + Cloudflare Pages | 🔄 In progress |
| T07 | Email notifications | ⏳ Planned |

---

## Related Projects

- **[MED487](https://github.com/sorinHus/med487)** — Medical practice management app (same stack, production-deployed) · [Live demo](https://med487.pages.dev)
- **[MRU_Tracker](https://github.com/sorinHus/MRU_Tracker)** — Multi-user HR file tracking tool · [Live demo](https://sorinhus.github.io/MRU_Tracker/hr_file_manager_DEMO.html)

---

## License

Private project — all rights reserved.
