import { useEffect, useState } from 'react'
import { useAuth } from '../../app/AppProviders'

export function AdminPage() {
  const { token } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    document.title = 'ballot-sign • Admin'
  }, [])

  useEffect(() => {
    if (!token) {
      setIsAdmin(false)
      return
    }
    fetch('/api/ballot/admin/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((resp) => (resp.ok ? resp.json() : { is_admin: false }))
      .then((data) => setIsAdmin(Boolean(data.is_admin)))
      .catch(() => setIsAdmin(false))
  }, [token])

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Admin</h1>
      {isAdmin === false ? (
        <p className="muted">You do not have access to this page.</p>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <p className="muted" style={{ marginTop: 0 }}>
            Admin actions affect all petitions. Proceed carefully.
          </p>
          <button
            type="button"
            onClick={async () => {
              if (!token) {
                setStatus('Login required.')
                return
              }
              setIsRunning(true)
              setStatus(null)
              try {
                const resp = await fetch('/api/ballot/admin/dedupe-signatures', {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                })
                if (!resp.ok) {
                  const text = await resp.text().catch(() => '')
                  throw new Error(text || `Dedupe failed (${resp.status})`)
                }
                const data = await resp.json()
                setStatus(`Deduped signatures. Kept: ${data.kept ?? 0}, removed: ${data.removed ?? 0}.`)
              } catch (err) {
                setStatus(err instanceof Error ? err.message : 'Dedupe failed.')
              } finally {
                setIsRunning(false)
              }
            }}
            disabled={isRunning}
            style={{ background: '#b42318', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1rem' }}
          >
            {isRunning ? 'Deduplicating…' : 'Deduplicate signatures'}
          </button>
          {status ? (
            <p className="muted" role="status" style={{ marginBottom: 0 }}>
              {status}
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}
