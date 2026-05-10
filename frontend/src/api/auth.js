import api from './axios'

export const login = async (username, password) => {
  const res = await api.post('/auth/login/', { username, password })
  console.log('LOGIN RESPONSE:', res.data)
  localStorage.setItem('access_token', res.data.access)
  localStorage.setItem('refresh_token', res.data.refresh)
  const meRes = await api.get('/auth/me/', {
    headers: { Authorization: `Bearer ${res.data.access}` }
  })
  return meRes.data
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

export const getColleagues = () => api.get('/users/colleagues/').then(r => r.data)