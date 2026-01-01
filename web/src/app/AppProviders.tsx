import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppServices } from '../composition/createServices'
import type { UserRole } from '../domain/user/User'
import type { SessionUser } from '../ui/auth/SessionUser'

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
  setRole: (role: UserRole | 'guest') => void
  setUser: (user: SessionUser | null) => void
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
  const raw = localStorage.getItem('demo.user')
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

  const servicesValue = useMemo<ServicesContextValue>(() => ({ services: props.services }), [props.services])

  const authValue = useMemo<AuthContextValue>(
    () => ({
      role,
      user,
      setRole: (r) => {
        setRoleState(r)
        localStorage.setItem('demo.role', r)
        if (r === 'guest') {
          setUserState(null)
          localStorage.removeItem('demo.user')
        }
      },
      setUser: (u) => {
        setUserState(u)
        if (!u) localStorage.removeItem('demo.user')
        else localStorage.setItem('demo.user', JSON.stringify(u))
      },
    }),
    [role, user],
  )

  return (
    <ServicesContext.Provider value={servicesValue}>
      <AuthContext.Provider value={authValue}>{props.children}</AuthContext.Provider>
    </ServicesContext.Provider>
  )
}
