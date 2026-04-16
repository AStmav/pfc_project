import client from './client'

export async function registerUser(payload) {
  const response = await client.post('/auth/register/', payload)
  return response.data
}

export async function loginUser(payload) {
  const response = await client.post('/auth/token/', payload)
  return response.data
}

export async function getCurrentUser() {
  const response = await client.get('/auth/me/')
  return response.data
}
