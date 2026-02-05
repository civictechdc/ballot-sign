import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'

export function PublicCampaignManagerPage() {
  const { handle } = useParams()

  useEffect(() => {
    document.title = `ballot-sign • Campaign manager • ${handle ?? ''}`
  }, [handle])

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Campaign manager</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Public profile page (mock)
      </p>
      <p>
        Handle: <code>{handle}</code>
      </p>
      <p className="muted">This page will eventually show initiatives managed by this campaign and verified contact info.</p>
      <Link to="/">Back to home</Link>
    </section>
  )
}
