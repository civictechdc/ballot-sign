import type { SignatureRepository, CreateSignatureInput } from '../../application/ports/SignatureRepository'
import type { Signature } from '../../domain/signature/Signature'

const STORAGE_KEY = 'demo.signatures'

function readAll(): Signature[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as Signature[]
  } catch {
    return []
  }
}

function writeAll(items: Signature[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export class MockSignatureRepository implements SignatureRepository {
  async createSignature(input: CreateSignatureInput): Promise<Signature> {
    const now = new Date().toISOString()
    const signature: Signature = {
      id: `sig_${Math.random().toString(16).slice(2)}`,
      initiativeId: input.initiativeId,
      createdAtISO: now,
      isAnonymous: input.isAnonymous,
      signerName: input.signerName,
      signerAddress: input.signerAddress,
      signerEmail: input.signerEmail,
      signerPhone: input.signerPhone,
    }
    const all = readAll()
    all.unshift(signature)
    writeAll(all)
    return signature
  }
}
