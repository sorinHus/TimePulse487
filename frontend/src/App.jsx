import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Login from './pages/Login'
import DashboardEmployee from './pages/DashboardEmployee'
import Layout from './components/Layout'
import DashboardManager from './pages/DashboardManager'
import DashboardAdmin from './pages/DashboardAdmin'
import { useAuth } from './context/AuthContext'
import Attendance from './pages/Attendance'
import Leaves from './pages/Leaves'
import Calendar from './pages/Calendar'


function DashboardRoute() {
  const { user } = useAuth()
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
            <Route path= "/calendat" element={<Calendar />} />
            <Route path="/reports" element={<div style={{color:'#f1f5f9'}}>Reports — coming soon</div>} />
            <Route path="/team" element={<div style={{color:'#f1f5f9'}}>Team — coming soon</div>} />
            <Route path="/admin" element={<div style={{color:'#f1f5f9'}}>Admin — coming soon</div>} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App