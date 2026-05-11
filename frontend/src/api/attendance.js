import api from './axios'

export const checkIn = (notes = '') => api.post('/attendance/check-in/', { notes })
export const checkOut = (notes = '') => api.post('/attendance/check-out/', { notes })
export const getTodayAttendance = () => api.get('/attendance/today/').then(r => r.data)
export const getAttendanceHistory = (month) =>
  api.get(`/attendance/history/?month=${month}`).then(r => r.data)
export const getTeamAttendance = (date) =>
  api.get(`/attendance/team/?date=${date}`)