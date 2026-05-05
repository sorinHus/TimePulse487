import api from './axios'

export const checkIn = (notes = '') => api.post('/attendance/check-in/', { notes })
export const checkOut = (notes = '') => api.post('/attendance/check-out/', { notes })
export const getTodayAttendance = () => api.get('/attendance/today/')
export const getAttendanceHistory = (month, year) =>
  api.get(`/attendance/history/?month=${month}&year=${year}`)
export const getTeamAttendance = (date) =>
  api.get(`/attendance/team/?date=${date}`)