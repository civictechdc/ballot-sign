import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export function CampaignRegisterPage() {
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    document.title = 'ballot-sign • Campaign manager registration'
  }, [])

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
        <button type="button" onClick={() => alert('Registered (mock). Use header Demo mode switch for now.')}>Register</button>
        <p className="muted" style={{ marginBottom: 0 }}>
          Already have an account? <Link to="/campaign/login">Login</Link>
        </p>
      </div>
    </section>
  )
}
