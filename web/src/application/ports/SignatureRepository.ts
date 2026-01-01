import type { Signature } from '../../domain/signature/Signature'

export type CreateSignatureInput = {
  initiativeId: string
  isAnonymous: boolean
  signerName?: string
  signerAddress?: string
  signerEmail?: string
  signerPhone?: string
}

export interface SignatureRepository {
  createSignature(input: CreateSignatureInput): Promise<Signature>
}
