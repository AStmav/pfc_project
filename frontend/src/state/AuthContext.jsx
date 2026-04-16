import { useEffect, useMemo, useState } from 'react'
import { getCurrentUser, loginUser, registerUser } from '../api/auth'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from '../lib/authStorage'
import { AuthContext } from './authContextObject'

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => getAccessToken())
  const [refreshToken, setRefreshToken] = useState(() => getRefreshToken())
  const [currentUser, setCurrentUser] = useState(null)

  const isAuthenticated = Boolean(accessToken)
  const isAdmin = String(currentUser?.role ?? '').toUpperCase() === 'ADMIN'

  useEffect(() => {
    let ignore = false

    async function syncCurrentUser() {
      if (!accessToken) {
        if (!ignore) {
          setCurrentUser(null)
        }
        return
      }
      try {
        const profile = await getCurrentUser()
        if (!ignore) {
          setCurrentUser(profile)
        }
      } catch {
        if (!ignore) {
          setCurrentUser(null)
        }
      }
    }

    syncCurrentUser()
    return () => {
      ignore = true
    }
  }, [accessToken])

  async function login(credentials) {
    const tokens = await loginUser(credentials)
    saveTokens(tokens)
    setAccessToken(tokens.access ?? null)
    setRefreshToken(tokens.refresh ?? null)
    try {
      const profile = await getCurrentUser()
      setCurrentUser(profile)
    } catch {
      setCurrentUser(null)
    }
    return tokens
  }

  async function register(payload) {
    return registerUser(payload)
  }

  function logout() {
    clearTokens()
    setAccessToken(null)
    setRefreshToken(null)
    setCurrentUser(null)
  }

  const value = useMemo(
    () => ({
      accessToken,
      refreshToken,
      isAuthenticated,
      currentUser,
      isAdmin,
      login,
      register,
      logout,
    }),
    [accessToken, refreshToken, isAuthenticated, currentUser, isAdmin],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
