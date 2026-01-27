import type { UserRole } from '../../domain/user/User'

export type SessionUser = {
  id: string
  role: UserRole
  displayName: string
  handle: string
  email?: string
  fullName?: string | null
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
}
