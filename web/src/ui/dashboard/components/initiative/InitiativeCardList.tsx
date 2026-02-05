import type { InitiativeCardModel } from './InitiativeCardModel'
import { InitiativeCard } from './InitiativeCard'

export function InitiativeCardList(props: { initiatives: InitiativeCardModel[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {props.initiatives.map((i) => (
        <InitiativeCard
          key={i.id}
          title={i.title}
          category={i.category}
          signaturesCurrent={i.signaturesCurrent}
          signaturesGoal={i.signaturesGoal}
          onSign={i.onPrimaryAction}
        />
      ))}
    </div>
  )
}
