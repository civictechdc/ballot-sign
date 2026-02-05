import { useEffect, useState } from 'react'

export function CampaignProfilePage() {
  const [displayName, setDisplayName] = useState('Safer Streets DC')
  const [bio, setBio] = useState('We advocate for safer streets and Vision Zero infrastructure in Washington, DC.')

  useEffect(() => {
    document.title = 'ballot-sign • Campaign profile'
  }, [])

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Public profile (campaign manager)</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Static demo form.
      </p>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        <div>
          <label className="muted" htmlFor="dn">
            Display name
          </label>
          <input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label className="muted" htmlFor="bio">
            Bio
          </label>
          <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} style={{ width: '100%' }} />
        </div>
        <button type="button" onClick={() => alert('Saved (mock)')}>Save profile</button>
      </div>
    </section>
  )
}
