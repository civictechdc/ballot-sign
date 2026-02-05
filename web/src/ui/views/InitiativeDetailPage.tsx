import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useServices } from '../../app/AppProviders'
import { getInitiativeBySlug } from '../../application/usecases/getInitiativeBySlug'
import type { Initiative } from '../../domain/initiative/Initiative'

function TagPill(props: { tag: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: '0.2rem 0.5rem',
        border: '1px solid var(--border)',
        borderRadius: 999,
        background: 'color-mix(in oklab, var(--panel) 70%, black 30%)',
      }}
    >
      {props.tag}
    </span>
  )
}

export function InitiativeDetailPage() {
  const { slug } = useParams()
  const { initiativeRepository } = useServices()
  const [initiative, setInitiative] = useState<Initiative | null>(null)
  const [showRelated, setShowRelated] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!slug) return
    getInitiativeBySlug(initiativeRepository, slug).then((x) => {
      setInitiative(x)
      document.title = x ? `ballot-sign • ${x.title}` : 'ballot-sign • Initiative'
    })
  }, [initiativeRepository, slug])

  const stats = useMemo(() => {
    if (!initiative) return null
    const pct = Math.min(100, Math.round((initiative.signatureCount / initiative.signatureGoal) * 100))
    return { pct }
  }, [initiative])

  if (!initiative) {
    return (
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Initiative not found</h1>
        <p className="muted">Check the URL or return to the homepage.</p>
        <Link to="/">Go home</Link>
      </section>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section className="panel">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <h1 style={{ margin: 0, fontSize: '1.9rem', lineHeight: 1.15, flex: '1 1 420px' }}>{initiative.title}</h1>
          <span className="muted">Status: {initiative.status}</span>
        </div>

        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
          <div className="muted" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span>
              Signatures: <strong>{initiative.signatureCount.toLocaleString()}</strong> / {initiative.signatureGoal.toLocaleString()}
            </span>
            <span>Deadline: {initiative.signatureDeadlineISO}</span>
            <span>Created: {initiative.createdAtISO}</span>
          </div>

          <div aria-label="Progress" style={{ height: 10, background: 'var(--panel-2)', borderRadius: 999, border: '1px solid var(--border)' }}>
            <div
              style={{
                height: '100%',
                width: `${stats?.pct ?? 0}%`,
                background: 'linear-gradient(90deg, var(--primary), var(--primary-2))',
                borderRadius: 999,
              }}
            />
          </div>
        </div>

        <p style={{ marginTop: '0.9rem' }}>{initiative.summary}</p>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Link to={`/initiatives/${initiative.slug}/sign`}>
            <strong>Sign this initiative</strong>
          </Link>
          <button type="button" onClick={() => alert('Saved (mock)')}>Save</button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(location.href).then(() => alert('Link copied (mock)'))}>
            Share
          </button>
          <button type="button" onClick={() => alert('Reported (mock)')} style={{ borderColor: 'color-mix(in oklab, var(--danger) 70%, var(--border) 30%)' }}>
            Report
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Text excerpt</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Expand to preview the first paragraph of the initiative text.
        </p>
        <button type="button" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Collapse' : 'Expand'}
        </button>
        {expanded && <p style={{ marginTop: '0.8rem' }}>{initiative.textFirstParagraph}</p>}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Topic tags</h2>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {initiative.topicTags.map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Endorsements</h2>
        <ul>
          {initiative.endorsements.map((e, idx) => (
            <li key={idx}>
              <strong>{e.by}</strong>
              {e.quote ? <span className="muted"> — “{e.quote}”</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Updates</h2>
        <ul style={{ paddingLeft: '1.2rem' }}>
          {initiative.updates.map((u, idx) => (
            <li key={idx} style={{ marginBottom: '0.6rem' }}>
              <div className="muted" style={{ fontSize: 13 }}>
                {u.dateISO}
              </div>
              <div style={{ fontWeight: 700 }}>{u.title}</div>
              <div className="muted">{u.body}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Forum</h2>
        <ul style={{ paddingLeft: '1.2rem' }}>
          {initiative.forumComments.map((c) => (
            <li key={c.id} style={{ marginBottom: '0.6rem' }}>
              <div className="muted" style={{ fontSize: 13 }}>
                {c.dateISO} • {c.author}
              </div>
              <div>{c.body}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Related initiatives</h2>
        {!showRelated ? (
          <button type="button" onClick={() => setShowRelated(true)}>
            Show related initiatives
          </button>
        ) : (
          <ul>
            <li className="muted">(Mock) Related initiatives will appear here.</li>
          </ul>
        )}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Campaign manager</h2>
        <p>
          Managed by{' '}
          <Link to={`/campaign-managers/${initiative.campaignManager.handle}`}>{initiative.campaignManager.displayName}</Link>
        </p>
      </section>
    </div>
  )
}
