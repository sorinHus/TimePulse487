import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import Admin from './pages/Admin'
import Team from './pages/Team'

function DashboardRoute() {
  const { user } = useAuth()
  if (user?.role === 'director') return <DashboardManager />
  if (user?.role === 'manager') return <DashboardManager />
  if (user?.role === 'admin') return <DashboardAdmin />
  return <DashboardEmployee />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<DashboardRoute />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/leaves" element={<Leaves />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/team" element={<Team />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App