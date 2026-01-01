import type { InitiativeRepository } from '../ports/InitiativeRepository'

export async function getInitiativeBySlug(repo: InitiativeRepository, slug: string) {
  return repo.getBySlug(slug)
}
