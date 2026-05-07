# TimePulse487 — HR Management SaaS App

> **Status: In active development**

A full-stack HR management application for employee attendance tracking, leave management, and workforce reporting. Built with Django 5 + DRF on the backend and React + Vite on the frontend.

---

## Overview

TimePulse487 is a SaaS platform designed to streamline daily HR operations. It provides a structured workflow for employee check-in/check-out, leave request management with hierarchical approval, team calendar visibility, and exportable reports — all behind a role-based access system secured with JWT authentication.

The project follows the same architecture as [MED487](https://github.com/sorinHus/med487) (also in this portfolio), with Railway for backend hosting and Cloudflare Pages for the frontend.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python · Django 5 · Django REST Framework |
| Database | PostgreSQL |
| Authentication | JWT (djangorestframework-simplejwt) |
| Frontend | React · Vite · CSS Modules |
| HTTP client | Axios (with JWT interceptor) |
| Excel export | openpyxl |
| PDF export | ReportLab |
| Deploy | Railway (backend) · Cloudflare Pages (frontend) |

---

## Planned Features

### Attendance
- Daily check-in / check-out with timestamps
- Attendance history per employee
- Late arrivals and early departures flagged automatically
- Monthly attendance summary per employee

### Leave Management
- Multiple leave types (annual, sick, unpaid, etc.)
- Leave balance tracking per employee per year
- Leave request submission with date range and type
- Calendar conflict detection

### Approval Workflow
- Hierarchical approval: Employee → Manager → HR
- Email notifications at each approval step
- Reject with reason, approve, or escalate
- Full approval history per request

### Reporting & Export
- Attendance reports: daily, weekly, monthly
- Leave balance reports per department
- Excel export (openpyxl)
- PDF export (ReportLab)

### Platform
- Role-based dashboards: Employee · Manager · HR Administrator
- JWT authentication with refresh token handling
- Organizational hierarchy (departments, teams, managers)
- Responsive design — desktop and mobile

---

## Architecture

```
Browser (React/Vite — Cloudflare Pages)
        │  HTTPS · JSON · JWT
        ▼
Django 5 + DRF (Railway)
        │  ORM
        ▼
PostgreSQL (Railway)
```

**Auth flow:** JWT stored in `localStorage`. Axios interceptor attaches `Authorization: Bearer <token>` to every request. Auto-refresh on 401 response.

---

## Project Structure

```
TimePulse4/
├── backend/
│   ├── settings.py
│   └── urls.py
├── employees/              # Employee profiles, departments, hierarchy
├── attendance/             # Check-in/check-out, daily records
├── leaves/                 # Leave types, requests, balances, approvals
├── reports/                # Export endpoints (Excel, PDF)
└── frontend/
    ├── src/
    │   ├── App.jsx         # Router + role guards
    │   ├── components/
    │   │   ├── Dashboard.jsx
    │   │   ├── Attendance.jsx
    │   │   ├── Leaves.jsx
    │   │   ├── Approvals.jsx
    │   │   ├── Calendar.jsx
    │   │   └── Reports.jsx
    │   └── *.module.css    # CSS Modules per component
    └── public/
```

---

## Development Status

| Module | Status |
|---|---|
| Project setup, Django + DRF + JWT | ✅ Done |
| React + Vite + CSS Modules scaffold | ✅ Done |
| User model + roles | ✅ Done |
| Attendance check-in/check-out | 🔧 In progress |
| Leave requests + approval workflow | 📋 Planned |
| Team calendar | 📋 Planned |
| Reports + Excel/PDF export | 📋 Planned |
| Railway + Cloudflare Pages deploy | 📋 Planned |

---

## Related Projects

- **[MED487](https://github.com/sorinHus/med487)** — Medical practice management app (same stack, production-deployed)
- **[MRU_Tracker](https://github.com/sorinHus/MRU_Tracker)** — Multi-user HR file tracking tool (vanilla JS, live demo)

---

## License

Private project — all rights reserved.
