import api from './axios'

export const login = async (username, password) => {
  const res = await api.post('/auth/login/', { username, password })
  localStorage.setItem('access_token', res.data.access)
  localStorage.setItem('refresh_token', res.data.refresh)
  return res.data
}

export const logout = async () => {
  const refresh = localStorage.getItem('refresh_token')
  try {
    await api.post('/auth/logout/', { refresh })
  } finally {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }
}

export const getMe = async () => {
  const res = await api.get('/auth/me/')
  return res.data
}