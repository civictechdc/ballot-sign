import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useServices } from '../../app/AppProviders'
import { listInitiatives } from '../../application/usecases/listInitiatives'
import type { Initiative } from '../../domain/initiative/Initiative'
import { useLegislativeBody } from '../legislativeBodies'

export function LandingPage() {
  const { initiativeRepository } = useServices()
  const { body: legislativeBody } = useLegislativeBody()
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
    <div style={{ display: 'grid', gap: '2rem', position: 'relative' }}>
      {/* Toggle button to switch to standalone HTML version */}
      <a
        href="/standalone.html"
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: 'var(--btn-primary-bg)',
          color: 'var(--btn-primary-text)',
          padding: '0.875rem 1.5rem',
          borderRadius: 'var(--radius-full)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          fontWeight: 600,
          fontSize: '0.9rem',
          textDecoration: 'none',
          zIndex: 1000,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.18)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)'
        }}
      >
        Switch to Standalone HTML →
      </a>

      <section className="panel" style={{ padding: '2.5rem 2rem' }}>
        <h1
          className="serif"
          style={{
            margin: 0,
            fontSize: '2.75rem',
            lineHeight: 1.1,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          Your Voice for {legislativeBody}.
        </h1>
        <p className="muted" style={{ marginTop: '1rem', fontSize: '1.05rem', lineHeight: 1.5 }}>
          Discover, support, and sign ballot initiatives that matter to you and your community.
        </p>
        <div style={{ marginTop: '1.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 400px', position: 'relative' }}>
            <label className="sr-only" htmlFor="search">
              Search for ballot initiatives
            </label>
            <input
              id="search"
              placeholder="Search for ballot initiatives (e.g., environment, housing)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                fontSize: '1rem',
                border: '1.5px solid var(--border-input)',
              }}
            />
          </div>
          <Link
            to="/constituent/register"
            className="panel"
            style={{
              padding: '0.75rem 1.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              textDecoration: 'none',
            }}
          >
            Create Account
          </Link>
          <Link
            to="/constituent/login"
            className="panel"
            style={{
              padding: '0.75rem 1.25rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              textDecoration: 'none',
            }}
          >
            Login
          </Link>
        </div>
      </section>

      <section>
        <h2 className="serif" style={{ margin: '0 0 1.25rem', fontSize: '1.75rem', fontWeight: 700 }}>
          Top Ballot Measures
        </h2>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {featured.map((i) => (
            <article
              key={i.id}
              className="panel"
              style={{
                padding: '1.5rem',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div
                  aria-hidden="true"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--icon-tile-bg)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <h3 className="serif" style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.15rem', fontWeight: 600, lineHeight: 1.3 }}>
                    {i.title}
                  </h3>
                </div>
              </div>
              <p className="muted" style={{ marginTop: 0, marginBottom: '1rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
                {i.summary}
              </p>
              <div className="muted" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem', marginBottom: '1rem' }}>
                <span>Status: {i.status}</span>
                <span>
                  {i.signatureCount.toLocaleString()} / {i.signatureGoal.toLocaleString()}
                </span>
                <span>Deadline: {i.signatureDeadlineISO}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link to={`/initiatives/${i.slug}`} className="btn-primary" style={{ flex: '1 1 auto' }}>
                  View Details
                </Link>
                <Link to={`/initiatives/${i.slug}/sign`} className="btn-secondary">
                  Sign
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
