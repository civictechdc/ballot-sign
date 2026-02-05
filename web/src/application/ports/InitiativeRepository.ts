import type { Initiative, InitiativeSlug } from '../../domain/initiative/Initiative'

export type InitiativeListQuery = {
  search?: string
  sort?: 'newest' | 'deadline'
  tags?: string[]
}

export interface InitiativeRepository {
  list(query?: InitiativeListQuery): Promise<Initiative[]>
  getBySlug(slug: InitiativeSlug): Promise<Initiative | null>
}
