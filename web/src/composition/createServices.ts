import type { InitiativeRepository } from '../application/ports/InitiativeRepository'
import type { SignatureRepository } from '../application/ports/SignatureRepository'
import { MockInitiativeRepository } from '../infrastructure/mocks/MockInitiativeRepository'
import { MockSignatureRepository } from '../infrastructure/mocks/MockSignatureRepository'

export type AppServices = {
  initiativeRepository: InitiativeRepository
  signatureRepository: SignatureRepository
}

function createInitiativeRepository(): InitiativeRepository {
  // Factory Method seam: swap mock vs API later without touching use cases/UI.
  const source = (import.meta as any).env?.VITE_DATA_SOURCE ?? 'mock'
  if (source === 'mock') return new MockInitiativeRepository()
  return new MockInitiativeRepository()
}

function createSignatureRepository(): SignatureRepository {
  const source = (import.meta as any).env?.VITE_DATA_SOURCE ?? 'mock'
  if (source === 'mock') return new MockSignatureRepository()
  return new MockSignatureRepository()
}

export function createServices(): AppServices {
  return {
    initiativeRepository: createInitiativeRepository(),
    signatureRepository: createSignatureRepository(),
  }
}
