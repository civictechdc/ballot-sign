import { useEffect, useState } from 'react'

export function ConstituentProfilePage() {
  const [displayName, setDisplayName] = useState('Demo Constituent')
  const [bio, setBio] = useState('Interested in local policy and civic engagement.')

  useEffect(() => {
    document.title = 'ballot-sign • Constituent profile'
  }, [])

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Public profile (constituent)</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Demo-only editable form.
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
        <button type="button" onClick={() => alert('Profile saved (mock)')}>
          Save profile
        </button>
      </div>
    </section>
  )
}
