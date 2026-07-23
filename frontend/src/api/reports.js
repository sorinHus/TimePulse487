import api from './axios'

export const getPontajSheet = (departmentId, year, month) =>
  api.get(`/reports/pontaj/sheet/?department_id=${departmentId}&year=${year}&month=${month}`).then(r => r.data)

export const patchPontajEntry = (entryId, data) =>
  api.patch(`/reports/pontaj/entries/${entryId}/`, data).then(r => r.data)

export const generatePontajSheet = (sheetId) =>
  api.post(`/reports/pontaj/sheet/${sheetId}/generate/`).then(r => r.data)

export const reviewPontajSheet = (sheetId, action, rejectionNote = '') =>
  api.post(`/reports/pontaj/sheet/${sheetId}/review/`, { action, rejection_note: rejectionNote }).then(r => r.data)
