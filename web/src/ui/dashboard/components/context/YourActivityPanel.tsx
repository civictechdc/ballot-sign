import { SectionHeader } from '../SectionHeader'
import { ActivityRow } from './activity/ActivityRow'

export function YourActivityPanel(props: { signed: string[]; following: string[] }) {
  return (
    <section
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <SectionHeader title="Your Activity" size="small" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <ActivityRow label="Signed" value={props.signed[0] ?? ''} />
        <ActivityRow label="Following" value={props.following[0] ?? ''} />
      </div>
    </section>
  )
}
