import api from './axios'

export const getLeaveTypes = () => api.get('/leaves/types/').then(r => r.data)
export const getLeaveBalance = (year) => api.get(`/leaves/balance/?year=${year}`).then(r => r.data)
export const getLeaveRequests = () => api.get('/leaves/requests/').then(r => r.data)
export const createLeaveRequest = (data) => api.post('/leaves/requests/', data).then(r => r.data)
export const cancelLeaveRequest = (id) => api.delete(`/leaves/requests/${id}/`).then(r => r.data)
export const approveLeave = (id, note = '') =>
  api.post(`/leaves/requests/${id}/approve/`, { review_note: note }).then(r => r.data)
export const rejectLeave = (id, note = '') =>
  api.post(`/leaves/requests/${id}/reject/`, { review_note: note }).then(r => r.data)
export const approveLeaveRequest = approveLeave
export const rejectLeaveRequest = rejectLeave 
export const getWorkingDays = (start, end) =>
  api.get(`/leaves/working-days/?start=${start}&end=${end}`).then(r => r.data)
export const registerSickLeave = (data) =>
  api.post('/leaves/sick-leave/register/', data).then((r) => r.data);

// B17 — Annual Leave Schedule
export const getSchedule = (year) =>
  api.get(`/leaves/schedule/?year=${year}`).then(r => r.data)
export const saveSchedule = (year, monthly_plan) =>
  api.put(`/leaves/schedule/?year=${year}`, { monthly_plan }).then(r => r.data)
export const submitSchedule = (id) =>
  api.post(`/leaves/schedule/${id}/submit/`).then(r => r.data)
export const reviewSchedule = (id, action, review_note = '') =>
  api.post(`/leaves/schedule/${id}/review/`, { action, review_note }).then(r => r.data)
export const getTeamSchedule = (year, user_id = null) => {
  const params = `year=${year}${user_id ? `&user_id=${user_id}` : ''}`
  return api.get(`/leaves/schedule/team/?${params}`).then(r => r.data)
}