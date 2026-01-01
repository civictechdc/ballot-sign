import type { InitiativeRepository, InitiativeListQuery } from '../ports/InitiativeRepository'

export async function listInitiatives(repo: InitiativeRepository, query?: InitiativeListQuery) {
  return repo.list(query)
}
