import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../../app/AppProviders'
import { useLegislativeBody } from '../../legislativeBodies'

type Initiative = {
  id: string
  title: string
  description?: string
  required_signatures: number
  current_signatures: number
  progress_percentage: number
  location?: string
  created_by?: string
  collaborators?: string[]
  comments?: Array<{
    id: string
    author: string
    dateISO: string
    body: string
  }>
}

type SignatureRecord = {
  id: string
  initiative_id: string
  user_id: string
  name?: string
  email?: string
  zip_code?: string
  signature_image?: string
  timestamp?: string
}

type CommentRecord = {
  id: string
  initiative_id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
  updated_at: string
}

type UserProfile = {
  id: string
  display_name?: string
  full_name?: string
  avatar_url?: string
}

export function CampaignInitiativeBallotPage() {
  const { id } = useParams()
  const { token, user } = useAuth()
  const { body: legislativeBody } = useLegislativeBody()
  const [initiative, setInitiative] = useState<Initiative | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState<boolean>(false)
  const [canManage, setCanManage] = useState<boolean>(false)
  const [authors, setAuthors] = useState<UserProfile[]>([])
  const [requestStatus, setRequestStatus] = useState<string | null>(null)
  const [isSigning, setIsSigning] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentStatus, setCommentStatus] = useState<string | null>(null)
  const [mySignature, setMySignature] = useState<SignatureRecord | null>(null)
  const [signatureStatus, setSignatureStatus] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentRecord[]>([])
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<string>('')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)

  useEffect(() => {
    if (!id) return
    document.title = 'ballot-sign • Initiative ballot'
    fetch(`/api/ballot/initiatives/${id}`)
      .then(async (resp) => {
        if (!resp.ok) {
          const text = await resp.text().catch(() => '')
          throw new Error(text || `Failed to load initiative (${resp.status})`)
        }
        return resp.json()
      })
      .then((data) => setInitiative(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load initiative'))
  }, [id])

  useEffect(() => {
    if (commentStatus) {
      const id = window.setTimeout(() => setCommentStatus(null), 3000)
      return () => window.clearTimeout(id)
    }
  }, [commentStatus])

  useEffect(() => {
    if (!id || !token) return
    fetch(`/api/ballot/initiatives/${id}/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((resp) => (resp.ok ? resp.json() : null))
      .then((data) => {
        if (!data) return
        setCanEdit(Boolean(data.can_edit))
        setCanManage(Boolean(data.can_manage))
      })
      .catch(() => {})
  }, [id, token])

  useEffect(() => {
    if (!id || !token) {
      setMySignature(null)
      return
    }
    fetch(`/api/ballot/initiatives/${id}/signatures/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((resp) => (resp.ok ? resp.json() : null))
      .then((data) => {
        if (data) setMySignature(data)
        else setMySignature(null)
      })
      .catch(() => setMySignature(null))
  }, [id, token])

  useEffect(() => {
    if (!initiative) return
    const ids = [initiative.created_by, ...(initiative.collaborators || [])].filter(Boolean) as string[]
    if (!ids.length) return
    fetch(`/pidp/auth/public/users?ids=${encodeURIComponent(ids.join(','))}`)
      .then((resp) => (resp.ok ? resp.json() : []))
      .then((data) => setAuthors(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [initiative])

  useEffect(() => {
    if (!id) return
    fetch(`/api/ballot/initiatives/${id}/comments`)
      .then(async (resp) => {
        if (!resp.ok) {
          const text = await resp.text().catch(() => '')
          throw new Error(text || `Failed to load comments (${resp.status})`)
        }
        return resp.json()
      })
      .then((data) => setComments(Array.isArray(data) ? data : []))
      .catch((err) => setCommentsError(err instanceof Error ? err.message : 'Failed to load comments'))
  }, [id])

  useEffect(() => {
    if (!isSigning || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1a1a1a'

    function getPoint(event: MouseEvent | TouchEvent) {
      const rect = canvas.getBoundingClientRect()
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
      return { x: clientX - rect.left, y: clientY - rect.top }
    }

    function start(event: MouseEvent | TouchEvent) {
      if (!ctx) return
      drawing.current = true
      const point = getPoint(event)
      ctx.beginPath()
      ctx.moveTo(point.x, point.y)
    }

    function move(event: MouseEvent | TouchEvent) {
      if (!ctx) return
      if (!drawing.current) return
      const point = getPoint(event)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
    }

    function end() {
      drawing.current = false
    }

    canvas.addEventListener('mousedown', start)
    canvas.addEventListener('mousemove', move)
    canvas.addEventListener('mouseup', end)
    canvas.addEventListener('mouseleave', end)
    canvas.addEventListener('touchstart', start)
    canvas.addEventListener('touchmove', move)
    canvas.addEventListener('touchend', end)

    return () => {
      canvas.removeEventListener('mousedown', start)
      canvas.removeEventListener('mousemove', move)
      canvas.removeEventListener('mouseup', end)
      canvas.removeEventListener('mouseleave', end)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove', move)
      canvas.removeEventListener('touchend', end)
    }
  }, [isSigning])

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Ballot</h1>
      {error ? <p className="muted">{error}</p> : null}
      {!initiative && !error ? <p className="muted">Loading…</p> : null}
      {initiative ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>{initiative.title}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {initiative.description || 'No description provided.'}
          </p>
          {authors.length ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {authors.map((author) => {
                const label = author.display_name || author.full_name || 'Contributor'
                const initials = label
                  .split(' ')
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
                return (
                  <Link
                    key={author.id}
                    to={`/campaign-managers/${author.id}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
                  >
                    {author.avatar_url ? (
                      <img
                        src={author.avatar_url}
                        alt={label}
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: 'var(--color-cream-dark)',
                          border: '1px solid var(--color-border)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {initials || 'U'}
                      </div>
                    )}
                    <span style={{ color: 'var(--color-text-primary)' }}>{label}</span>
                  </Link>
                )
              })}
            </div>
          ) : null}
          <div className="muted" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span>Location: {initiative.location || legislativeBody}</span>
            <span>
              Signatures: {initiative.current_signatures.toLocaleString()} /{' '}
              {initiative.required_signatures.toLocaleString()}
            </span>
            <span>Progress: {initiative.progress_percentage.toFixed(1)}%</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {!mySignature ? (
              <button
                type="button"
                onClick={() => setIsSigning(true)}
                style={{
                  background: 'var(--color-sage)',
                  color: 'var(--color-white)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '0.65rem 1rem',
                  cursor: 'pointer',
                }}
              >
                Sign this initiative
              </button>
            ) : null}
            {canEdit ? (
              <Link
                to={`/campaign/initiatives/${initiative.id}/edit`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: '0.6rem 1rem',
                  textDecoration: 'none',
                  color: 'var(--color-text-primary)',
                }}
              >
                Edit initiative
              </Link>
            ) : null}
            {!canEdit ? (
              <button
                type="button"
                onClick={async () => {
                  if (!token) {
                    setRequestStatus('Login required to request edit access.')
                    return
                  }
                  try {
                    const resp = await fetch(`/api/ballot/initiatives/${initiative.id}/edit-requests`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ message: 'Requesting edit access.' }),
                    })
                    if (!resp.ok) {
                      const text = await resp.text().catch(() => '')
                      throw new Error(text || `Request failed (${resp.status})`)
                    }
                    setRequestStatus('Edit request sent.')
                  } catch (err) {
                    setRequestStatus(err instanceof Error ? err.message : 'Request failed.')
                  }
                }}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: '0.6rem 1rem',
                  background: 'var(--color-white)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
              >
                Request edit access
              </button>
            ) : null}
          </div>
          {requestStatus ? (
            <p className="muted" role="status" style={{ marginBottom: 0 }}>
              {requestStatus}
            </p>
          ) : null}
        </div>
      ) : null}

      {initiative ? (
        <div className="panel" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginTop: 0 }}>Your signature</h2>
          {token ? (
            mySignature ? (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {mySignature.signature_image ? (
                  <img
                    src={mySignature.signature_image}
                    alt="Your signature"
                    style={{ maxWidth: 320, border: '1px solid var(--color-border)', borderRadius: 8, background: '#fff' }}
                  />
                ) : (
                  <p className="muted">Signature recorded.</p>
                )}
                <div className="muted" style={{ fontSize: 13 }}>
                  Signed on {mySignature.timestamp ? new Date(mySignature.timestamp).toLocaleString() : 'Unknown date'}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!token) return
                      try {
                        const resp = await fetch(`/api/ballot/initiatives/${initiative.id}/signatures/me`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${token}` },
                        })
                        if (!resp.ok) {
                          const text = await resp.text().catch(() => '')
                          throw new Error(text || `Remove failed (${resp.status})`)
                        }
                        setMySignature(null)
                        setSignatureStatus('Signature removed.')
                      } catch (err) {
                        setSignatureStatus(err instanceof Error ? err.message : 'Remove failed.')
                      }
                    }}
                  >
                    Remove signature
                  </button>
                  {signatureStatus ? <span className="muted">{signatureStatus}</span> : null}
                </div>
              </div>
            ) : (
              <p className="muted">You have not signed this initiative yet.</p>
            )
          ) : (
            <p className="muted">Log in to view your signature.</p>
          )}
        </div>
      ) : null}

      {initiative ? (
        <div className="panel" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginTop: 0 }}>Comments</h2>
          {commentsError ? <p className="muted">{commentsError}</p> : null}
          {comments.length ? (
            <ul style={{ paddingLeft: '1.2rem' }}>
              {comments.map((comment) => {
                const canModify = Boolean(
                  token && (comment.author_id === user?.id || canManage),
                )
                const isEditing = editingCommentId === comment.id
                return (
                  <li key={comment.id} style={{ marginBottom: '0.75rem' }}>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {new Date(comment.created_at).toLocaleString()} • {comment.author_name}
                    </div>
                    {isEditing ? (
                      <textarea
                        rows={3}
                        value={editingDraft}
                        onChange={(event) => setEditingDraft(event.target.value)}
                        style={{ width: '100%', marginTop: '0.35rem' }}
                      />
                    ) : (
                      <div>{comment.body}</div>
                    )}
                    {canModify ? (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!token) return
                                try {
                                  const resp = await fetch(
                                    `/api/ballot/initiatives/${initiative.id}/comments/${comment.id}`,
                                    {
                                      method: 'PUT',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${token}`,
                                      },
                                      body: JSON.stringify({ body: editingDraft }),
                                    },
                                  )
                                  if (!resp.ok) {
                                    const text = await resp.text().catch(() => '')
                                    throw new Error(text || `Update failed (${resp.status})`)
                                  }
                                  const updated = await resp.json()
                                  setComments((prev) =>
                                    prev.map((item) => (item.id === comment.id ? { ...item, ...updated } : item)),
                                  )
                                  setEditingCommentId(null)
                                  setEditingDraft('')
                                } catch (err) {
                                  setCommentStatus(err instanceof Error ? err.message : 'Update failed.')
                                }
                              }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCommentId(null)
                                setEditingDraft('')
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCommentId(comment.id)
                                setEditingDraft(comment.body)
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!token) return
                                try {
                                  const resp = await fetch(
                                    `/api/ballot/initiatives/${initiative.id}/comments/${comment.id}`,
                                    {
                                      method: 'DELETE',
                                      headers: { Authorization: `Bearer ${token}` },
                                    },
                                  )
                                  if (!resp.ok) {
                                    const text = await resp.text().catch(() => '')
                                    throw new Error(text || `Delete failed (${resp.status})`)
                                  }
                                  setComments((prev) => prev.filter((item) => item.id !== comment.id))
                                } catch (err) {
                                  setCommentStatus(err instanceof Error ? err.message : 'Delete failed.')
                                }
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="muted">No comments yet.</p>
          )}
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <label className="muted" htmlFor="initiative-comment">
              Add a comment
            </label>
            <textarea
              id="initiative-comment"
              rows={3}
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Share your thoughts on this initiative."
              style={{ width: '100%' }}
              disabled={!token}
            />
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={async () => {
                  if (!commentDraft.trim()) return
                  if (!token || !initiative) {
                    setCommentStatus('Login required to comment.')
                    return
                  }
                  try {
                    const resp = await fetch(`/api/ballot/initiatives/${initiative.id}/comments`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ body: commentDraft }),
                    })
                    if (!resp.ok) {
                      const text = await resp.text().catch(() => '')
                      throw new Error(text || `Comment failed (${resp.status})`)
                    }
                    const created = await resp.json()
                    setComments((prev) => [...prev, created])
                    setCommentDraft('')
                    setCommentStatus('Comment posted.')
                  } catch (err) {
                    setCommentStatus(err instanceof Error ? err.message : 'Comment failed.')
                  }
                }}
                disabled={!token}
              >
                Post comment
              </button>
              {commentStatus ? (
                <span className="muted" role="status">
                  {commentStatus}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {isSigning ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              maxWidth: 560,
              width: '100%',
              background: 'var(--color-white)',
              borderRadius: 12,
              padding: '1.25rem 1.5rem',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ fontSize: '1.1rem' }}>Sign this initiative</strong>
              <button type="button" onClick={() => setIsSigning(false)} aria-label="Close">
                ×
              </button>
            </div>
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Draw your signature below.
            </p>
            <canvas
              ref={canvasRef}
              width={480}
              height={200}
              style={{
                width: '100%',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                background: '#fff',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  const ctx = canvasRef.current?.getContext('2d')
                  if (!ctx || !canvasRef.current) return
                  ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!initiative) return
                  try {
                    const signatureImage = canvasRef.current?.toDataURL('image/png') ?? undefined
                    const resp = await fetch(`/api/ballot/initiatives/${initiative.id}/sign`, {
                      method: 'POST',
                      headers: token
                        ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
                        : { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ initiative_id: initiative.id, signature_image: signatureImage }),
                    })
                    if (!resp.ok) {
                      const text = await resp.text().catch(() => '')
                      throw new Error(text || `Sign failed (${resp.status})`)
                    }
                    const data = await resp.json().catch(() => null)
                    if (data?.signature_id && token) {
                      const mine = await fetch(`/api/ballot/initiatives/${initiative.id}/signatures/me`, {
                        headers: { Authorization: `Bearer ${token}` },
                      }).then((r) => (r.ok ? r.json() : null))
                      if (mine) setMySignature(mine)
                    }
                    setIsSigning(false)
                  } catch {
                    setIsSigning(false)
                  }
                }}
              >
                Submit signature
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
