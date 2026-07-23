import api from './axios'

export const getPontajSheet = (departmentId, year, month) =>
  api.get(`/reports/pontaj/sheet/?department_id=${departmentId}&year=${year}&month=${month}`).then(r => r.data)

export const savePontajSheet = (sheetId, entries) =>
  api.post(`/reports/pontaj/sheet/${sheetId}/save/`, { entries }).then(r => r.data)

export const regeneratePontajSheet = (sheetId) =>
  api.post(`/reports/pontaj/sheet/${sheetId}/regenerate/`).then(r => r.data)

export const submitPontajSheet = (sheetId, entries = []) =>
  api.post(`/reports/pontaj/sheet/${sheetId}/submit/`, { entries }).then(r => r.data)

export const reviewPontajSheet = (sheetId, action, rejectionNote = '') =>
  api.post(`/reports/pontaj/sheet/${sheetId}/review/`, { action, rejection_note: rejectionNote }).then(r => r.data)
