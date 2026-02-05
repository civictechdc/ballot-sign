export function PrimaryButton(props: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="sans"
      style={{
        width: '100%',
        background: 'var(--btn-primary-bg)',
        color: 'var(--btn-primary-text)',
        border: '1px solid var(--btn-primary-bg)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 24px',
        fontSize: 16,
        fontWeight: 500,
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in oklab, var(--btn-primary-bg) 90%, black 10%)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--btn-primary-bg)'
      }}
    >
      {props.label}
    </button>
  )
}
