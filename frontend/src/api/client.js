import axios from 'axios'
import { API_BASE_URL } from '../config'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '../lib/authStorage'

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

client.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const isUnauthorized = error.response?.status === 401
    const isRefreshCall = originalRequest?.url?.includes('/auth/token/refresh/')
    const alreadyRetried = originalRequest?._retry

    if (!isUnauthorized || isRefreshCall || alreadyRetried) {
      return Promise.reject(error)
    }

    const refresh = getRefreshToken()
    if (!refresh) {
      clearTokens()
      return Promise.reject(error)
    }

    originalRequest._retry = true
    try {
      const refreshResponse = await client.post('/auth/token/refresh/', { refresh })
      saveTokens({ access: refreshResponse.data.access, refresh })
      originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.access}`
      return client(originalRequest)
    } catch (refreshError) {
      clearTokens()
      return Promise.reject(refreshError)
    }
  },
)

export default client
