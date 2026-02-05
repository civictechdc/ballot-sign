import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../../app/AppProviders'
import { useLegislativeBody } from '../../legislativeBodies'

export function CampaignInitiativeEditorPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { token } = useAuth()
  const { body: legislativeBody } = useLegislativeBody()
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [goal, setGoal] = useState(25000)
  const [deadline, setDeadline] = useState('2026-05-15')
  const [collaborators, setCollaborators] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    document.title = id ? 'ballot-sign • Edit initiative' : 'ballot-sign • Create/manage initiative'
    if (!id) return
    fetch(`/api/ballot/initiatives/${id}`)
      .then((resp) => (resp.ok ? resp.json() : null))
      .then((data) => {
        if (!data) return
        setTitle(data.title || '')
        setSummary(data.description || '')
        setGoal(Number(data.required_signatures || 25000))
        setDeadline('2026-05-15')
        if (Array.isArray(data.collaborators)) {
          setCollaborators(data.collaborators.join(', '))
        }
      })
      .catch(() => {})
  }, [id])

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Create / manage initiative</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Static demo form.
      </p>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        <div>
          <label className="muted" htmlFor="title">
            Title
          </label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label className="muted" htmlFor="summary">
            Summary
          </label>
          <textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} style={{ width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label className="muted" htmlFor="goal">
              Signature goal
            </label>
            <input id="goal" type="number" value={goal} onChange={(e) => setGoal(Number(e.target.value))} style={{ width: '100%' }} />
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <label className="muted" htmlFor="deadline">
              Signature deadline
            </label>
            <input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>
        <div>
          <label className="muted" htmlFor="collaborators">
            Collaborators (PIdP user IDs or emails, comma-separated)
          </label>
          <input
            id="collaborators"
            value={collaborators}
            onChange={(e) => setCollaborators(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
        {status ? (
          <p className="muted" role="status" style={{ marginBottom: 0 }}>
            {status}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={async () => {
              setStatus(null)
              try {
                if (!token) {
                  setStatus('You must be logged in to save an initiative.')
                  return
                }
                const collaboratorList = collaborators
                  .split(',')
                  .map((entry) => entry.trim())
                  .filter(Boolean)

                const resp = await fetch(id ? `/api/ballot/initiatives/${id}` : '/api/ballot/initiatives', {
                  method: id ? 'PUT' : 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    title,
                    description: summary,
                    required_signatures: goal,
                    location: legislativeBody,
                    collaborators: collaboratorList,
                  }),
                })

                if (!resp.ok) {
                  const text = await resp.text().catch(() => '')
                  throw new Error(text || `Save failed (${resp.status})`)
                }

                const saved = await resp.json()
                setStatus('Initiative saved.')
                const initiativeId = saved?.id || id
                if (initiativeId) {
                  navigate(`/campaign/initiatives/${initiativeId}/ballot`)
                }
              } catch (err) {
                setStatus(err instanceof Error ? err.message : 'Save failed.')
              }
            }}
          >
            {id ? 'Update initiative' : 'Save initiative'}
          </button>
          {id ? (
            <button type="button" onClick={() => navigate(`/campaign/initiatives/${id}/ballot`)}>
              Back
            </button>
          ) : (
            <button type="button" onClick={() => navigate('/campaign/initiatives')}>
              Back
            </button>
          )}
          {id ? (
            <button
              type="button"
              onClick={async () => {
                if (!token) {
                  setStatus('You must be logged in to delete an initiative.')
                  return
                }
                const confirmed = window.confirm('Delete this initiative? This cannot be undone.')
                if (!confirmed) return
                try {
                  const resp = await fetch(`/api/ballot/initiatives/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  if (!resp.ok) {
                    const text = await resp.text().catch(() => '')
                    throw new Error(text || `Delete failed (${resp.status})`)
                  }
                  alert('Initiative deleted.')
                  navigate('/campaign/initiatives')
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : 'Delete failed.')
                }
              }}
              style={{
                background: '#b42318',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '0.6rem 1rem',
              }}
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
