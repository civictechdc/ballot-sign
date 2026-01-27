import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../app/AppProviders'

type Initiative = {
  id: string
  title: string
  description?: string
  location?: string
}

export function CampaignEditableInitiativesPage() {
  const { token } = useAuth()
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'ballot-sign • Editable initiatives'
  }, [])

  useEffect(() => {
    if (!token) {
      setError('Login required.')
      return
    }
    let cancelled = false
    fetch('/api/ballot/initiatives/editable-list', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (resp) => {
        if (!resp.ok) {
          const text = await resp.text().catch(() => '')
          throw new Error(text || `Failed to load initiatives (${resp.status})`)
        }
        return resp.json()
      })
      .then((data) => {
        if (cancelled) return
        setInitiatives(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load initiatives')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Initiatives you can edit</h1>
      {error ? <p className="muted">{error}</p> : null}
      {initiatives.length ? (
        <ul style={{ paddingLeft: '1.2rem' }}>
          {initiatives.map((initiative) => (
            <li key={initiative.id} style={{ marginBottom: '0.75rem' }}>
              <strong>{initiative.title}</strong>
              {initiative.location ? <div className="muted">Target: {initiative.location}</div> : null}
              {initiative.description ? <div className="muted">{initiative.description}</div> : null}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                <Link to={`/campaign/initiatives/${initiative.id}/edit`}>Edit</Link>
                <Link to={`/campaign/initiatives/${initiative.id}/ballot`}>View</Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        !error && <p className="muted">No initiatives available for editing.</p>
      )}
    </section>
  )
}
