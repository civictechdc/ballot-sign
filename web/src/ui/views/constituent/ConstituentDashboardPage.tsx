import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useServices } from '../../../app/AppProviders'
import { listInitiatives } from '../../../application/usecases/listInitiatives'
import type { Initiative } from '../../../domain/initiative/Initiative'

export function ConstituentDashboardPage() {
  const { initiativeRepository } = useServices()
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Initiative[]>([])
  const [hasNotifications] = useState(true)

  useEffect(() => {
    document.title = 'ballot-sign • Constituent dashboard'
  }, [])

  useEffect(() => {
    listInitiatives(initiativeRepository, { sort: 'newest', search: q }).then(setItems)
  }, [initiativeRepository, q])

  const recommendations = useMemo(() => items.slice(0, 2), [items])
  const recent = useMemo(() => items.slice(0, 4), [items])

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section className="panel">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <h1 style={{ margin: 0 }}>Constituent dashboard</h1>
          <span className="muted">Notifications: {hasNotifications ? '●' : '○'}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <label className="sr-only" htmlFor="search2">
            Search initiatives
          </label>
          <input
            id="search2"
            placeholder="Search initiatives"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: '1 1 320px' }}
          />
          <select aria-label="Filter" defaultValue="all">
            <option value="all">All topics</option>
            <option value="transportation">Transportation</option>
            <option value="environment">Environment</option>
            <option value="public-safety">Public safety</option>
          </select>
          <select aria-label="Sort" defaultValue="newest">
            <option value="newest">Newest</option>
            <option value="deadline">Deadline</option>
          </select>
        </div>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Recommendations</h2>
        <ul>
          {recommendations.map((i) => (
            <li key={i.id}>
              <Link to={`/initiatives/${i.slug}`}>{i.title}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Recently created initiatives</h2>
        <ul>
          {recent.map((i) => (
            <li key={i.id}>
              <Link to={`/initiatives/${i.slug}`}>{i.title}</Link>
              <span className="muted"> — {i.createdAtISO}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Saved / signed / viewed</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          For the demo, these are placeholders. Later they’ll be driven by real persistence and user identity.
        </p>
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => alert('Saved initiatives (mock)')}>Saved</button>
          <button type="button" onClick={() => alert('Signed initiatives (mock)')}>Signed</button>
          <button type="button" onClick={() => alert('Recently viewed (mock)')}>Recently viewed</button>
        </div>
      </section>
    </div>
  )
}
