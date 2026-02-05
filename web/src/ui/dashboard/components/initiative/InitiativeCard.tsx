import { IconTile } from './IconTile'
import { InitiativeTitle } from './InitiativeTitle'
import { SignatureProgress } from './SignatureProgress'
import { PrimaryButton } from './PrimaryButton'

export function InitiativeCard(props: {
  title: string
  signaturesCurrent: number
  signaturesGoal: number
  category: string
  onSign: () => void
}) {
  return (
    <article
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 28,
        boxShadow: 'var(--shadow-card)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        columnGap: 20,
      }}
    >
      <IconTile icon={props.category} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <InitiativeTitle title={props.title} />
        <div style={{ marginTop: 16 }}>
          <SignatureProgress current={props.signaturesCurrent} goal={props.signaturesGoal} />
        </div>
        <div style={{ marginTop: 20 }}>
          <PrimaryButton label="Sign Petition" onClick={props.onSign} />
        </div>
      </div>
    </article>
  )
}
