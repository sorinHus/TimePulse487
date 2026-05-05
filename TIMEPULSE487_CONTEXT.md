# TimePulse487 — Context Proiect

## Descriere
Aplicație SaaS de management HR — pontaj zilnic (check-in/check-out) și concedii, cu flux de aprobare ierarhică, calendar echipă, rapoarte Excel/PDF și dashboard-uri per rol.

---

## Stack
- **Backend:** Django 5 + Django REST Framework + PostgreSQL
- **Frontend:** React + Vite + CSS Modules
- **Auth:** JWT (djangorestframework-simplejwt)
- **Export:** openpyxl (Excel), reportlab (PDF)
- **Deploy viitor:** Railway (backend) + Cloudflare Pages (frontend)

---

## Locație proiect
- **Backend:** `D:\TimePulse4\`
- **Frontend:** `D:\TimePulse4\frontend\`
- **Mediu virtual:** `D:\TimePulse4\venv\` (activare: `venv\Scripts\activate`)

---

## Superuser Django
- **Username:** `sorin487`
- **Role:** admin
- **Password:** Admin2026!

---

## Comenzi utile

### Backend
```bash
cd D:\TimePulse4
venv\Scripts\activate
python manage.py runserver
python manage.py makemigrations
python manage.py migrate
```

### Frontend
```bash
cd D:\TimePulse4\frontend
npm run dev
```

---

## Structură Backend

```
D:\TimePulse4\
├── timepulse487/       # settings, urls, wsgi
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── accounts/           # User, Department, auth
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   ├── urls.py
│   └── admin.py
├── attendance/         # CheckIn/CheckOut
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   ├── urls.py
│   └── admin.py
├── leaves/             # LeaveType, LeaveBalance, LeaveRequest
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   ├── urls.py
│   └── admin.py
├── reports/            # Calendar, Export, Dashboard
│   ├── views.py
│   └── urls.py
├── manage.py
└── .env
```

---

## Structură Frontend

```
D:\TimePulse4\frontend\src\
├── api/
│   ├── axios.js         # Axios instance + interceptors JWT
│   ├── auth.js          # login, logout, getMe
│   ├── attendance.js    # checkIn, checkOut, history
│   ├── leaves.js        # getLeaveTypes, createLeaveRequest, approve/reject
│   └── dashboard.js     # getAdminDashboard, export Excel/PDF
├── components/          # Componente reutilizabile (Button, Navbar, etc.)
├── pages/               # Pagini (Login, Dashboard, etc.)
├── hooks/               # Custom hooks
├── context/
│   └── AuthContext.jsx  # useAuth(), AuthProvider
└── styles/
    ├── variables.css    # CSS custom properties (culori, spacing, etc.)
    ├── reset.css        # Reset CSS
    └── global.css       # Clase globale (card, badge, container)
```

---

## Roluri utilizatori
| Rol | Permisiuni |
|-----|-----------|
| `admin` | Acces complet, vede toți angajații |
| `manager` | Vede și aprobă echipa sa |
| `employee` | Pontaj propriu + cereri concediu |

---

## Endpoint-uri API

### Auth
| Method | URL | Descriere |
|--------|-----|-----------|
| POST | `/api/auth/login/` | Login → JWT tokens |
| POST | `/api/auth/refresh/` | Refresh access token |
| POST | `/api/auth/logout/` | Logout (blacklist refresh) |
| GET | `/api/auth/me/` | Date utilizator curent |
| POST | `/api/auth/register/` | Creare user (doar admin) |
| POST | `/api/auth/change-password/` | Schimbare parolă |
| GET | `/api/users/` | Listă utilizatori (doar admin) |

### Attendance
| Method | URL | Descriere |
|--------|-----|-----------|
| POST | `/api/attendance/check-in/` | Check-in |
| POST | `/api/attendance/check-out/` | Check-out + calcul ore |
| GET | `/api/attendance/today/` | Pontaj azi |
| GET | `/api/attendance/history/` | Istoric lunar |
| GET | `/api/attendance/team/` | Pontaj echipă (admin/manager) |

### Leaves
| Method | URL | Descriere |
|--------|-----|-----------|
| GET | `/api/leaves/types/` | Tipuri concediu |
| GET | `/api/leaves/balance/` | Sold zile |
| GET/POST | `/api/leaves/requests/` | Listă/creare cereri |
| GET/DELETE | `/api/leaves/requests/<id>/` | Detaliu/anulare cerere |
| POST | `/api/leaves/requests/<id>/approve/` | Aprobare |
| POST | `/api/leaves/requests/<id>/reject/` | Respingere |

### Dashboard & Reports
| Method | URL | Descriere |
|--------|-----|-----------|
| GET | `/api/dashboard/admin/` | Dashboard admin |
| GET | `/api/dashboard/manager/` | Dashboard manager |
| GET | `/api/dashboard/employee/` | Dashboard angajat |
| GET | `/api/calendar/` | Calendar echipă lunar |
| GET | `/api/reports/attendance/export/` | Export Excel pontaj |
| GET | `/api/reports/leaves/export/` | Export PDF concedii |

---

## Tipuri de concediu (seeded)
1. **Annual Leave** — 21 zile, plătit, `#3B82F6`
2. **Sick Leave** — 30 zile, plătit, `#EF4444`
3. **Unpaid Leave** — 30 zile, neplătit, `#6B7280`

---

## Utilizatori de test
- `sorin487` — admin/superuser
- `ion.popescu` — employee, manager: sorin487

---

## Status taskuri
| Task | Status |
|------|--------|
| T01 — Setup proiect | ✅ Done |
| T02 — Modele User, Department | ✅ Done |
| T03 — JWT Auth | ✅ Done |
| T04 — Check-in / Check-out | ✅ Done |
| T05 — Leave Types + Balance | ✅ Done |
| T06 — Cerere concediu + aprobare | ✅ Done |
| T07 — Notificări email | ⏭️ Lăsat pentru final |
| T08 — Calendar echipă | ✅ Done |
| T09 — Export Excel | ✅ Done |
| T10 — Export PDF | ✅ Done |
| T11 — Dashboard Admin | ✅ Done |
| T12 — Dashboard Manager | ✅ Done |
| T13 — Dashboard Angajat | ✅ Done |
| T14 — Frontend React | 🔄 În progres |

---

## Frontend — Status T14
- ✅ Setup Vite + React
- ✅ Pachete instalate (axios, react-router-dom, @tanstack/react-query, dayjs, recharts)
- ✅ Structură foldere (api, components, pages, hooks, context, styles)
- ✅ Stiluri globale (variables.css, reset.css, global.css)
- ✅ API layer (axios.js, auth.js, attendance.js, leaves.js, dashboard.js)
- ✅ AuthContext
- ⏳ Pagina Login
- ⏳ Layout (Sidebar + Topbar)
- ⏳ Dashboard pages
- ⏳ Attendance page
- ⏳ Leaves pages
- ⏳ Calendar page
- ⏳ Reports page
- ⏳ Admin pages

---

## Note importante
- Sorin lucrează în VS Code Desktop (nu GitHub.dev)
- Fără terminal access la Railway — deploy prin GitHub push
- CSS Modules pentru toate componentele (stiluri separate de logică)
- Aplicația e în **engleză**
