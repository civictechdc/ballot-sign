import { useEffect, useState } from 'react'

export function CampaignAccountPage() {
  const [email, setEmail] = useState('saferstreets@example.com')
  const [contactName, setContactName] = useState('Campaign Admin')

  useEffect(() => {
    document.title = 'ballot-sign • Campaign account'
  }, [])

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Account (campaign manager)</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Static demo form.
      </p>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        <div>
          <label className="muted" htmlFor="name">
            Contact name
          </label>
          <input id="name" value={contactName} onChange={(e) => setContactName(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label className="muted" htmlFor="email">
            Email
          </label>
          <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%' }} />
        </div>
        <button type="button" onClick={() => alert('Saved (mock)')}>Save account</button>
      </div>
    </section>
  )
}
