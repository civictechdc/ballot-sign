export type InitiativeCardModel = {
  id: string
  title: string
  category: string
  signaturesCurrent: number
  signaturesGoal: number
  onPrimaryAction: () => void
}
