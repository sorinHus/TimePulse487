import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import DashboardEmployee from './pages/DashboardEmployee'
import DashboardManager from './pages/DashboardManager'
import DashboardAdmin from './pages/DashboardAdmin'
import Attendance from './pages/Attendance'
import Leaves from './pages/Leaves'
import Calendar from './pages/Calendar'
import Reports from './pages/Reports'
import Pontaj from './pages/Pontaj'
import PontajGeneral from './pages/PontajGeneral'
import Admin from './pages/Admin'
import Team from './pages/Team'
import Notifications from './pages/Notifications'
import MobileApp from './pages/MobileApp'

function MobileRedirect() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isMobile && pathname !== '/m') {
      navigate('/m', { replace: true })
    }
  }, [navigate, pathname])
  return null
}

function DashboardRoute() {
  const { user } = useAuth()
  if (user?.effective_role === 'director') return <DashboardManager />
  if (user?.effective_role === 'manager') return <DashboardManager />
  if (user?.effective_role === 'admin') return <DashboardAdmin />
  return <DashboardEmployee />
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <AuthProvider>
      <BrowserRouter>
        <MobileRedirect />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/m" element={<MobileApp />} />
          <Route element={<Layout theme={theme} onToggleTheme={toggleTheme} />}>
            <Route path="/dashboard" element={<DashboardRoute />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/leaves" element={<Leaves />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/pontaj" element={<Pontaj />} />
            <Route path="/pontaj/general" element={<PontajGeneral />} />
            <Route path="/team" element={<Team />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/notifications" element={<Notifications />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App