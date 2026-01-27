import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../app/AppProviders'

export function CampaignRegisterPage() {
  const navigate = useNavigate()
  const { registerWithPassword, isLoading } = useAuth()
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'ballot-sign • Campaign manager registration'
  }, [])

  useEffect(() => {
    if (!isLoading && isSubmitting) {
      setIsSubmitting(false)
      navigate('/campaign/initiatives')
    }
  }, [isLoading, isSubmitting, navigate])

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Register (campaign manager)</h1>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        <div>
          <label className="muted" htmlFor="org">
            Organization / campaign name
          </label>
          <input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label className="muted" htmlFor="email">
            Email
          </label>
          <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label className="muted" htmlFor="pw">
            Password
          </label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%' }} />
        </div>
        {error ? (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                maxWidth: 520,
                width: '100%',
                background: '#fff1f1',
                border: '2px solid #c94c4c',
                color: '#7a1f1f',
                borderRadius: 12,
                padding: '1.25rem 1.5rem',
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <strong style={{ fontSize: '1.1rem' }}>Registration failed</strong>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    color: '#7a1f1f',
                  }}
                  aria-label="Close error dialog"
                >
                  ×
                </button>
              </div>
              <div style={{ marginTop: '0.75rem' }}>{error}</div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
                Check that the PIdP service is reachable at <code>/pidp</code>.
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  style={{
                    background: '#7a1f1f',
                    color: '#fff',
                    border: 'none',
                    padding: '0.5rem 0.9rem',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          disabled={isSubmitting || isLoading}
          onClick={async () => {
            setError(null)
            setIsSubmitting(true)
            try {
              await registerWithPassword(email, password, orgName || undefined)
            } catch (err) {
              setIsSubmitting(false)
              setError(err instanceof Error ? err.message : 'Registration failed')
            }
          }}
        >
          {isSubmitting || isLoading ? 'Creating account...' : 'Register'}
        </button>
        <p className="muted" style={{ marginBottom: 0 }}>
          Already have an account? <Link to="/campaign/login">Login</Link>
        </p>
      </div>
    </section>
  )
}
