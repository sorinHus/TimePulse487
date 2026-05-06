# TimePulse487 — HR Management SaaS App

> Full-stack HR management application for employee attendance tracking, leave management, and workforce reporting.

---

## Overview

TimePulse487 is a SaaS platform designed to streamline daily HR operations for organizations. It provides a structured workflow for employee check-in/check-out, leave request management with hierarchical approval, team calendar visibility, and exportable reports — all behind a role-based access system secured with JWT authentication.

---

## Features

- **Attendance Tracking** — Daily check-in/check-out with timestamps and history per employee
- **Leave Management** — Multiple leave types, balance tracking, and request submission
- **Approval Workflow** — Hierarchical approval flow (employee → manager → HR)
- **Team Calendar** — Visual overview of team availability and leave schedules
- **Reports & Exports** — Excel and PDF export for attendance and leave data
- **Role-Based Dashboards** — Separate views for employees, managers, and HR administrators
- **JWT Authentication** — Secure token-based auth with refresh handling

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Django 5 | Web framework |
| Django REST Framework | API layer |
| PostgreSQL | Database |
| djangorestframework-simplejwt | JWT authentication |
| django-cors-headers | CORS handling |
| openpyxl | Excel export |
| ReportLab | PDF export |

### Frontend
| Technology | Purpose |
|---|---|
| React + Vite | UI framework |
| CSS Modules | Scoped styling |
| Axios | HTTP client with JWT interceptors |

### Infrastructure (planned)
| Service | Purpose |
|---|---|
| Railway | Backend hosting |
| Cloudflare Pages | Frontend hosting |

---

## Project Structure

```
TimePulse4/
├── timepulse487/         # Django project settings & URLs
├── accounts/             # User model, departments, authentication
├── attendance/           # Check-in/check-out logic
├── leaves/               # Leave types, balances, requests
├── reports/              # Dashboard, calendar, exports
├── frontend/             # React + Vite application
│   └── src/
│       ├── api/          # Axios instance + API calls
│       ├── components/   # Reusable UI components
│       ├── pages/        # Route-level pages
│       ├── context/      # AuthContext (useAuth hook)
│       └── styles/       # CSS variables & global styles
├── manage.py
└── .env
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/sorinHus/TimePulse487.git
cd TimePulse487

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

```env
SECRET_KEY=your-secret-key
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=timepulse487
DB_USER=postgres
DB_PASSWORD=your-password
DB_HOST=localhost
DB_PORT=5432
```

---

## Status

🚧 **In active development**

---

## Author

**Sorin Vasile Hus**
- LinkedIn: [linkedin.com/in/sorinhus](https://linkedin.com/in/sorinhus)
- GitHub: [github.com/sorinHus](https://github.com/sorinHus)
