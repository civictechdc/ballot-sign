import { useEffect, useState } from 'react'

export function CampaignInitiativeEditorPage() {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [goal, setGoal] = useState(25000)
  const [deadline, setDeadline] = useState('2026-05-15')

  useEffect(() => {
    document.title = 'ballot-sign • Create/manage initiative'
  }, [])

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
        <button type="button" onClick={() => alert('Saved (mock)')}>Save initiative</button>
      </div>
    </section>
  )
}
