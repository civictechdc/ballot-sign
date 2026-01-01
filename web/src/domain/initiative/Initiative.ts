export type InitiativeStatus = 'draft' | 'active' | 'paused' | 'completed'

export type InitiativeSlug = string

export type Initiative = {
  id: string
  slug: InitiativeSlug

  title: string
  status: InitiativeStatus

  signatureCount: number
  signatureGoal: number
  signatureDeadlineISO: string

  createdAtISO: string

  summary: string
  textFirstParagraph: string

  topicTags: string[]
  endorsements: { by: string; quote?: string }[]
  updates: { dateISO: string; title: string; body: string }[]
  forumComments: { id: string; author: string; dateISO: string; body: string }[]

  campaignManager: {
    displayName: string
    handle: string
  }
}
