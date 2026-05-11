import api from './axios'

export const getAdminDashboard = () => api.get('/dashboard/admin/')
export const getManagerDashboard = () => api.get('/dashboard/manager/')
export const getEmployeeDashboard = () => api.get('/dashboard/employee/')
export const getTeamCalendar = (year, month, departmentId = null) => {
  let url = `/calendar/?year=${year}&month=${month}`
  if (departmentId) url += `&department=${departmentId}`
  return api.get(url).then(r => r.data)
}
export const exportAttendance = (year, month, userId = null) => {
  const params = userId
    ? `?year=${year}&month=${month}&user_id=${userId}`
    : `?year=${year}&month=${month}`
  return api.get(`/reports/attendance/export/${params}`, { responseType: 'blob' })
}
export const exportLeaves = (year, userId = null) => {
  const params = userId ? `?year=${year}&user_id=${userId}` : `?year=${year}`
  return api.get(`/reports/leaves/export/${params}`, { responseType: 'blob' })
}
export const exportAttendanceExcel = exportAttendance
export const exportLeavesPdf = exportLeaves