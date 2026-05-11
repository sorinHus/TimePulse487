import api from './axios'

// Legacy (păstrate temporar)
export const checkIn = (notes = '') => api.post('/attendance/check-in/', { notes })
export const checkOut = (notes = '') => api.post('/attendance/check-out/', { notes })
export const getTodayAttendance = () => api.get('/attendance/today/').then(r => r.data)
export const getAttendanceHistory = (month) =>
  api.get(`/attendance/history/?month=${month}`).then(r => r.data)
export const getTeamAttendance = (date) =>
  api.get(`/attendance/team/?date=${date}`).then(r => r.data)

// Noi — sesiuni multiple
export const clockIn = (notes = '') =>
  api.post('/attendance/clock-in/', { notes }).then(r => r.data)
export const clockOut = (notes = '') =>
  api.post('/attendance/clock-out/', { notes }).then(r => r.data)
export const getTodaySessions = () =>
  api.get('/attendance/today-sessions/').then(r => r.data)
export const getSessionHistory = (month) =>
  api.get(`/attendance/session-history/?month=${month}`).then(r => r.data)
export const getTeamSessions = (date) =>
  api.get(`/attendance/team-sessions/?date=${date}`).then(r => r.data)