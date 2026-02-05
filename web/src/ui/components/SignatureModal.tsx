import { createPortal } from 'react-dom'
import type { RefObject } from 'react'

type SignatureModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: () => void | Promise<void>
  onClear: () => void
  canvasRef: RefObject<HTMLCanvasElement>
  title?: string
}

export function SignatureModal({
  open,
  onClose,
  onSubmit,
  onClear,
  canvasRef,
  title = 'Sign this initiative',
}: SignatureModalProps) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-cream)',
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
          <strong style={{ fontSize: '1.1rem' }}>{title}</strong>
          <button type="button" onClick={onClose} aria-label="Close">
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
          <button type="button" onClick={onClear}>
            Clear
          </button>
          <button type="button" onClick={onSubmit}>
            Submit signature
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
