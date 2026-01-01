export type UserRole = 'constituent' | 'campaign_manager'

export type UserHandle = string

export type CampaignManagerProfile = {
  displayName: string
  handle: UserHandle
  bio?: string
}

export type ConstituentProfile = {
  displayName: string
  handle: UserHandle
  bio?: string
}
