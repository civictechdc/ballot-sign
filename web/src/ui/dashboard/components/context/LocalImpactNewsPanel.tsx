import { SectionHeader } from '../SectionHeader'
import { NewsItem } from './news/NewsItem'

function MapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 18 3 20V6l6-2 6 2 6-2v14l-6 2-6-2Z"
        stroke="var(--icon-stroke)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 4v14" stroke="var(--icon-stroke)" strokeWidth="2" />
      <path d="M15 6v14" stroke="var(--icon-stroke)" strokeWidth="2" />
    </svg>
  )
}

export function LocalImpactNewsPanel(props: { cityState: string; items: Array<{ id: string; title: string }> }) {
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
      <SectionHeader title="Local Impact & News" rightAdornment={<MapIcon />} size="small" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {props.items.map((i, idx) => (
          <NewsItem key={i.id} title={i.title} showDivider={idx !== props.items.length - 1} />
        ))}
      </div>
    </section>
  )
}
