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
