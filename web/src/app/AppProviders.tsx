import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppServices } from '../composition/createServices'
import type { UserRole } from '../domain/user/User'
import type { SessionUser } from '../ui/auth/SessionUser'

type PidpUser = {
  id: string
  email: string
  full_name: string | null
  identity_data?: {
    display_name?: string | null
    avatar_url?: string | null
    first_name?: string | null
    last_name?: string | null
  } | null
}

type ServicesContextValue = {
  services: AppServices
}

const ServicesContext = createContext<ServicesContextValue | null>(null)

export function useServices(): AppServices {
  const ctx = useContext(ServicesContext)
  if (!ctx) throw new Error('useServices must be used within AppProviders')
  return ctx.services
}

type AuthContextValue = {
  role: UserRole | 'guest'
  user: SessionUser | null
  token: string | null
  isLoading: boolean
  setRole: (role: UserRole | 'guest') => void
  setUser: (user: SessionUser | null) => void
  loginWithPassword: (email: string, password: string) => Promise<void>
  registerWithPassword: (email: string, password: string, fullName?: string) => Promise<void>
  completeOAuthLogin: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AppProviders')
  return ctx
}

function readInitialRole(): UserRole | 'guest' {
  const value = localStorage.getItem('demo.role')
  if (value === 'campaign_manager' || value === 'constituent' || value === 'guest') return value
  return 'guest'
}

function readInitialUser(): SessionUser | null {
  const raw = sessionStorage.getItem('pidp.user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

export function AppProviders(props: { services: AppServices; children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole | 'guest'>(() => readInitialRole())
  const [user, setUserState] = useState<SessionUser | null>(() => readInitialUser())
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('pidp.token'))
  const [isLoading, setIsLoading] = useState<boolean>(!!sessionStorage.getItem('pidp.token'))

  const pidpBaseUrl = (import.meta.env.VITE_PIDP_BASE_URL as string | undefined) ?? '/pidp'
  const normalizedPidpBase = pidpBaseUrl.replace(/\/$/, '')

  const servicesValue = useMemo<ServicesContextValue>(() => ({ services: props.services }), [props.services])

  const formatApiError = useCallback(async (resp: Response, fallback: string) => {
    const data = await resp.json().catch(() => null)
    if (data && Array.isArray(data.detail)) {
      const details = data.detail
        .map((item: { loc?: (string | number)[]; msg?: string }) => {
          if (!item || !item.msg) return null
          const field = item.loc?.slice(1).join('.') ?? 'request'
          return `${field}: ${item.msg}`
        })
        .filter(Boolean)
      if (details.length) return `${fallback} ${details.join('; ')}`
    }
    if (data?.detail) return `${fallback} ${data.detail}`
    const text = await resp.text().catch(() => '')
    return text ? `${fallback} ${text}` : fallback
  }, [])

  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      const body = new URLSearchParams()
      body.set('username', email)
      body.set('password', password)
      const resp = await fetch(`${normalizedPidpBase}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })
      if (!resp.ok) {
        throw new Error(await formatApiError(resp, 'Login failed.'))
      }
      const data = (await resp.json()) as { access_token: string; token_type: string }
      sessionStorage.setItem('pidp.token', data.access_token)
      setToken(data.access_token)
      setIsLoading(true)
    },
    [normalizedPidpBase],
  )

  const registerWithPassword = useCallback(
    async (email: string, password: string, fullName?: string) => {
      const resp = await fetch(`${normalizedPidpBase}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, full_name: fullName ?? null }),
      })
      if (!resp.ok) {
        if (resp.status === 409) {
          const data = await resp.json().catch(() => null)
          const detail =
            typeof data?.detail === 'string'
              ? data.detail
              : typeof data?.detail?.message === 'string'
                ? data.detail.message
                : null
          throw new Error(detail || 'Account already exists. Please log in.')
        }
        const message = await formatApiError(resp, `Registration failed (${resp.status}).`)
        throw new Error(message)
      }
      await loginWithPassword(email, password)
    },
    [normalizedPidpBase, loginWithPassword, formatApiError],
  )

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function hydrateSession(activeToken: string) {
      try {
        const resp = await fetch(`${normalizedPidpBase}/auth/me`, {
          headers: {
            Authorization: `Bearer ${activeToken}`,
          },
          signal: controller.signal,
        })
        if (!resp.ok) throw new Error('Invalid token')
        const data = (await resp.json()) as PidpUser
        const displayName = data.identity_data?.display_name?.trim() || data.full_name?.trim() || data.email
        const handle = data.email.split('@')[0]
        const avatarUrl = data.identity_data?.avatar_url ?? null
        const firstName = data.identity_data?.first_name ?? null
        const lastName = data.identity_data?.last_name ?? null
        if (cancelled) return
        setRoleState('constituent')
        localStorage.setItem('demo.role', 'constituent')
        setUserState({
          id: data.id,
          role: 'constituent',
          displayName,
          handle,
          email: data.email,
          fullName: data.full_name,
          firstName,
          lastName,
          avatarUrl,
        })
        sessionStorage.setItem(
          'pidp.user',
          JSON.stringify({
            id: data.id,
            role: 'constituent',
            displayName,
            handle,
            email: data.email,
            fullName: data.full_name,
            firstName,
            lastName,
            avatarUrl,
          }),
        )
      } catch {
        if (!cancelled) {
          setToken(null)
          setUserState(null)
          sessionStorage.removeItem('pidp.token')
          sessionStorage.removeItem('pidp.user')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    if (token) {
      hydrateSession(token)
    } else {
      setIsLoading(false)
    }

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [token, normalizedPidpBase])

  const authValue = useMemo<AuthContextValue>(
    () => ({
      role,
      user,
      token,
      isLoading,
      setRole: (r) => {
        setRoleState(r)
        localStorage.setItem('demo.role', r)
        if (r === 'guest') {
          setUserState(null)
          sessionStorage.removeItem('pidp.user')
        }
      },
      setUser: (u) => {
        setUserState(u)
        if (!u) sessionStorage.removeItem('pidp.user')
        else sessionStorage.setItem('pidp.user', JSON.stringify(u))
      },
      loginWithPassword,
      registerWithPassword,
      completeOAuthLogin: (accessToken: string) => {
        sessionStorage.setItem('pidp.token', accessToken)
        setToken(accessToken)
        setIsLoading(true)
      },
      logout: () => {
        setToken(null)
        setUserState(null)
        sessionStorage.removeItem('pidp.token')
        sessionStorage.removeItem('pidp.user')
      },
    }),
    [role, user, token, isLoading, loginWithPassword, registerWithPassword],
  )

  return (
    <ServicesContext.Provider value={servicesValue}>
      <AuthContext.Provider value={authValue}>{props.children}</AuthContext.Provider>
    </ServicesContext.Provider>
  )
}
