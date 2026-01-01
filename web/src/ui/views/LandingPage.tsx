import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useServices } from '../../app/AppProviders'
import { listInitiatives } from '../../application/usecases/listInitiatives'
import type { Initiative } from '../../domain/initiative/Initiative'

export function LandingPage() {
  const { initiativeRepository } = useServices()
  const [items, setItems] = useState<Initiative[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    document.title = 'ballot-sign • Discover and sign initiatives'
  }, [])

  useEffect(() => {
    listInitiatives(initiativeRepository, { sort: 'newest', search: q }).then(setItems)
  }, [initiativeRepository, q])

  const featured = useMemo(() => items.slice(0, 6), [items])

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section className="panel">
        <h1 style={{ margin: 0, fontSize: '2rem', lineHeight: 1.15 }}>Discover and sign DC ballot initiatives</h1>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Production-grade, open-source civic infrastructure—starting with a realistic demo UI and mock data.
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="sr-only" htmlFor="search">
            Search initiatives
          </label>
          <input
            id="search"
            placeholder="Search initiatives (e.g., streets, river)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: '1 1 320px' }}
          />
          <Link to="/constituent/register" className="panel" style={{ padding: '0.55rem 0.8rem' }}>
            Register (constituent)
          </Link>
          <Link to="/campaign/register" className="panel" style={{ padding: '0.55rem 0.8rem' }}>
            Register (campaign)
          </Link>
        </div>
      </section>

      <section>
        <h2 style={{ margin: '0.25rem 0 0.5rem' }}>Featured initiatives</h2>
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {featured.map((i) => (
            <article key={i.id} className="panel">
              <h3 style={{ marginTop: 0, marginBottom: '0.35rem' }}>{i.title}</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                {i.summary}
              </p>
              <div className="muted" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: 13 }}>
                <span>Status: {i.status}</span>
                <span>
                  Signatures: {i.signatureCount.toLocaleString()} / {i.signatureGoal.toLocaleString()}
                </span>
                <span>Deadline: {i.signatureDeadlineISO}</span>
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link to={`/initiatives/${i.slug}`}>View details</Link>
                <Link to={`/initiatives/${i.slug}/sign`}>Sign</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
