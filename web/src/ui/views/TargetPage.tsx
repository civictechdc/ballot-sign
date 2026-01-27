import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

type Initiative = {
  id: string
  title: string
  description?: string
  location?: string
}

export function TargetPage() {
  const { target } = useParams()
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'ballot-sign • Target'
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/ballot/initiatives')
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
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load initiatives')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const decodedTarget = target ? decodeURIComponent(target) : ''
  const filtered = useMemo(() => {
    const needle = decodedTarget.trim().toLowerCase()
    if (!needle) return initiatives
    return initiatives.filter((initiative) => (initiative.location || '').toLowerCase() === needle)
  }, [decodedTarget, initiatives])

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Target: {decodedTarget || 'All'}</h1>
      {error ? <p className="muted">{error}</p> : null}
      {filtered.length ? (
        <ul style={{ paddingLeft: '1.2rem' }}>
          {filtered.map((initiative) => (
            <li key={initiative.id} style={{ marginBottom: '0.75rem' }}>
              <Link to={`/campaign/initiatives/${initiative.id}/ballot`}>{initiative.title}</Link>
              {initiative.description ? <div className="muted">{initiative.description}</div> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No initiatives for this target yet.</p>
      )}
    </section>
  )
}
