import { useEffect, useState } from 'react'

export function ConstituentAccountPage() {
  const [email, setEmail] = useState('demo.constituent@example.com')
  const [address, setAddress] = useState('123 Example St NW, Washington, DC')

  useEffect(() => {
    document.title = 'ballot-sign • Constituent account'
  }, [])

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Account (constituent)</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Demo-only editable form.
      </p>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        <div>
          <label className="muted" htmlFor="email">
            Email
          </label>
          <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label className="muted" htmlFor="addr">
            Address
          </label>
          <input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: '100%' }} />
        </div>
        <button type="button" onClick={() => alert('Account saved (mock)')}>
          Save account
        </button>
      </div>
    </section>
  )
}
