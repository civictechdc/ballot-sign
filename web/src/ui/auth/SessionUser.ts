import type { UserRole } from '../../domain/user/User'

export type SessionUser = {
  id: string
  role: UserRole
  displayName: string
  handle: string
}
