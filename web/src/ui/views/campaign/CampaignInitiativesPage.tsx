import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export function CampaignInitiativesPage() {
  useEffect(() => {
    document.title = 'ballot-sign • Campaign initiatives'
  }, [])

  return (
    <section className="panel">
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h1 style={{ marginTop: 0, marginBottom: 0 }}>My ballot initiatives</h1>
        <span className="muted">(Static demo page)</span>
      </div>
      <p className="muted">Create and manage initiatives. In the demo, this is navigable but not yet backed by persistence.</p>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <Link to="/campaign/initiatives/new">Create new initiative</Link>
        <Link to="/campaign/profile">Public profile</Link>
        <Link to="/campaign/account">Account</Link>
      </div>
      <hr style={{ borderColor: 'var(--border)', margin: '1rem 0' }} />
      <ul>
        <li className="muted">(Mock) Safer Streets Initiative (2026)</li>
        <li className="muted">(Mock) Clean River Initiative</li>
      </ul>
    </section>
  )
}
