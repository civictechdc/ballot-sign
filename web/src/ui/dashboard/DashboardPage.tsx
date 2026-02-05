import { Hero } from './components/Hero'
import { SearchAndFilters } from './components/SearchAndFilters'
import { MainGrid } from './components/MainGrid'
import { useLegislativeBody } from '../legislativeBodies'
import { useRef, useState } from 'react'
import { SignatureModal } from '../components/SignatureModal'
import { useAuth } from '../../app/AppProviders'

/**
 * Ballot Initiative Dashboard page.
 *
 * Component hierarchy MUST match the spec:
 * AppShell > Header > Hero > SearchAndFilters > MainGrid.
 */
export function DashboardPage() {
  const { body: legislativeBody } = useLegislativeBody()
  const { token } = useAuth()
  const [signingInitiative, setSigningInitiative] = useState<{id: string, title: string} | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const handleSignInitiative = (initiative: {id: string, title: string}) => {
    setSigningInitiative(initiative)
  }

  const handleCloseModal = () => {
    setSigningInitiative(null)
  }

  const handleClearCanvas = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !canvasRef.current) return
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  const handleSubmitSignature = async () => {
    if (!signingInitiative) return
    try {
      const signatureImage = canvasRef.current?.toDataURL('image/png') ?? undefined
      const resp = await fetch(`/api/ballot/initiatives/${signingInitiative.id}/sign`, {
        method: 'POST',
        headers: token
          ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
          : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initiative_id: signingInitiative.id, signature_image: signatureImage }),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        throw new Error(text || `Sign failed (${resp.status})`)
      }
      setSigningInitiative(null)
    } catch {
      setSigningInitiative(null)
    }
  }

  return (
    <>
      <Hero cityState={legislativeBody} name="Alex" topics={['Environment', 'Education']} />
      <SearchAndFilters locationLabel={legislativeBody} topics={['Environment', 'Education']} />
      <MainGrid 
        cityState={legislativeBody} 
        onSignInitiative={handleSignInitiative}
      />
      <SignatureModal
        open={!!signingInitiative}
        onClose={handleCloseModal}
        canvasRef={canvasRef}
        onClear={handleClearCanvas}
        onSubmit={handleSubmitSignature}
        title={signingInitiative ? `Sign: ${signingInitiative.title}` : 'Sign this initiative'}
      />
    </>
  )
}
