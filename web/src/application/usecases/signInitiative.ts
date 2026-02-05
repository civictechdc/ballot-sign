import type { SignatureRepository } from '../ports/SignatureRepository'
import type { CreateSignatureInput } from '../ports/SignatureRepository'
import type { SessionUser } from '../../ui/auth/SessionUser'

export type SignInitiativeRequest = {
  initiativeId: string
  isAnonymous: boolean
  // When signed out, request additional fields.
  signerName?: string
  signerAddress?: string
  signerEmail?: string
  signerPhone?: string
}

export function validateSignInitiative(req: SignInitiativeRequest, user: SessionUser | null): string[] {
  const errors: string[] = []
  if (!req.initiativeId) errors.push('Missing initiative')

  if (!user) {
    if (!req.signerName?.trim()) errors.push('Name is required')
    if (!req.signerAddress?.trim()) errors.push('Address is required')
    if (!req.signerEmail?.trim()) errors.push('Email is required')
  }

  return errors
}

export async function signInitiative(
  repo: SignatureRepository,
  req: SignInitiativeRequest,
  user: SessionUser | null,
) {
  const errors = validateSignInitiative(req, user)
  if (errors.length) {
    return { ok: false as const, errors }
  }

  const input: CreateSignatureInput = {
    initiativeId: req.initiativeId,
    isAnonymous: req.isAnonymous,
    signerName: user ? undefined : req.signerName,
    signerAddress: user ? undefined : req.signerAddress,
    signerEmail: user ? undefined : req.signerEmail,
    signerPhone: user ? undefined : req.signerPhone,
  }

  const signature = await repo.createSignature(input)
  return { ok: true as const, signature }
}
