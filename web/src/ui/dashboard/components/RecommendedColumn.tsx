import { InitiativeCardList } from './initiative/InitiativeCardList'
import { SectionHeader } from './SectionHeader'
import type { InitiativeCardModel } from './initiative/InitiativeCardModel'

const initiatives: InitiativeCardModel[] = [
  {
    id: 'rec_1',
    title: 'Local Parks & Rec Bond: Your City Initiative',
    category: 'parks',
    signaturesCurrent: 12400,
    signaturesGoal: 25000,
    onPrimaryAction: () => alert('Sign Petition (mock)'),
  },
  {
    id: 'rec_2',
    title: 'Public Education Funding Initiative',
    category: 'education',
    signaturesCurrent: 8750,
    signaturesGoal: 20000,
    onPrimaryAction: () => alert('Sign Petition (mock)'),
  },
]

export function RecommendedColumn() {
  return (
    <div>
      <SectionHeader title="Recommended for You" />
      <InitiativeCardList initiatives={initiatives} />
    </div>
  )
}
