import type { InitiativeRepository, InitiativeListQuery } from '../../application/ports/InitiativeRepository'
import type { Initiative } from '../../domain/initiative/Initiative'
import { mockInitiatives } from './fixtures'

export class MockInitiativeRepository implements InitiativeRepository {
  async list(query?: InitiativeListQuery): Promise<Initiative[]> {
    const q = (query?.search ?? '').trim().toLowerCase()
    let items = [...mockInitiatives]
    if (q) {
      items = items.filter((i) => i.title.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q))
    }
    if (query?.tags?.length) {
      items = items.filter((i) => query.tags!.every((t) => i.topicTags.includes(t)))
    }
    if (query?.sort === 'deadline') {
      items.sort((a, b) => a.signatureDeadlineISO.localeCompare(b.signatureDeadlineISO))
    } else {
      items.sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO))
    }
    return items
  }

  async getBySlug(slug: string) {
    return mockInitiatives.find((i) => i.slug === slug) ?? null
  }
}
