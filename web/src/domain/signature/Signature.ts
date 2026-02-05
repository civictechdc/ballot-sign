export type Signature = {
  id: string
  initiativeId: string
  createdAtISO: string
  isAnonymous: boolean

  signerName?: string
  signerAddress?: string
  signerEmail?: string
  signerPhone?: string
}
