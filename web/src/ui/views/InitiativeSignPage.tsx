import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth, useServices } from '../../app/AppProviders'
import { getInitiativeBySlug } from '../../application/usecases/getInitiativeBySlug'
import type { Initiative } from '../../domain/initiative/Initiative'
import { signInitiative } from '../../application/usecases/signInitiative'

export function InitiativeSignPage() {
  const { slug } = useParams()
  const { initiativeRepository, signatureRepository } = useServices()
  const { user } = useAuth()

  const [initiative, setInitiative] = useState<Initiative | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [completeId, setCompleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    getInitiativeBySlug(initiativeRepository, slug).then((x) => {
      setInitiative(x)
      document.title = x ? `ballot-sign • Sign • ${x.title}` : 'ballot-sign • Sign'
    })
  }, [initiativeRepository, slug])

  if (!initiative) {
    return (
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Initiative not found</h1>
        <Link to="/">Go home</Link>
      </section>
    )
  }

  if (completeId) {
    return (
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Signature recorded (mock)</h1>
        <p className="muted">Confirmation ID: {completeId}</p>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link to={`/initiatives/${initiative.slug}`}>Back to details</Link>
          <Link to="/constituent/dashboard">Go to dashboard</Link>
        </div>
      </section>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Sign initiative</h1>
        <p style={{ marginBottom: 0 }}>
          You are signing: <Link to={`/initiatives/${initiative.slug}`}>{initiative.title}</Link>
        </p>
        <p className="muted" style={{ marginTop: '0.4rem' }}>
          Demo behavior: if signed out, we request name/address/email; if signed in, only the anonymous toggle.
        </p>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Signature</h2>

        {errors.length ? (
          <div role="alert" className="panel" style={{ borderColor: 'color-mix(in oklab, var(--danger) 65%, var(--border) 35%)' }}>
            <strong>Fix the following:</strong>
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
          Sign anonymously
        </label>

        {!user ? (
          <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.9rem' }}>
            <p className="muted" style={{ margin: 0 }}>
              Not signed in? You can sign without creating an account. If we need to verify your identity for your signature to
              be valid, we’ll reach out using the contact information you provide.
            </p>
            <div>
              <label htmlFor="name" className="muted">
                Full name
              </label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label htmlFor="address" className="muted">
                Address
              </label>
              <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label htmlFor="email" className="muted">
                Email
              </label>
              <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label htmlFor="phone" className="muted">
                Phone number
              </label>
              <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>
        ) : (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Signed in as {user.displayName}.
          </p>
        )}

        <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={async () => {
              setErrors([])
              const result = await signInitiative(
                signatureRepository,
                {
                  initiativeId: initiative.id,
                  isAnonymous,
                  signerName: name,
                  signerAddress: address,
                  signerEmail: email,
                  signerPhone: phone,
                },
                user,
              )
              if (!result.ok) setErrors(result.errors)
              else setCompleteId(result.signature.id)
            }}
          >
            Sign now
          </button>
          <button type="button" onClick={() => alert('Saved (mock)')}>Save initiative</button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(location.href).then(() => alert('Link copied (mock)'))}>
            Share
          </button>
          <button type="button" onClick={() => alert('Reported (mock)')} style={{ borderColor: 'color-mix(in oklab, var(--danger) 70%, var(--border) 30%)' }}>
            Report
          </button>
        </div>
      </section>
    </div>
  )
}
