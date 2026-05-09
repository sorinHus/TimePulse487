import api from './axios'

export const getLeaveTypes = () => api.get('/leaves/types/')
export const getLeaveBalance = (year) => api.get(`/leaves/balance/?year=${year}`)
export const getLeaveRequests = () => api.get('/leaves/requests/')
export const createLeaveRequest = (data) => api.post('/leaves/requests/', data)
export const cancelLeaveRequest = (id) => api.delete(`/leaves/requests/${id}/`)
export const approveLeave = (id, note = '') =>
  api.post(`/leaves/requests/${id}/approve/`, { review_note: note })
export const rejectLeave = (id, note = '') =>
  api.post(`/leaves/requests/${id}/reject/`, { review_note: note })
export const approveLeaveRequest = approveLeave
export const rejectLeaveRequest = rejectLeave