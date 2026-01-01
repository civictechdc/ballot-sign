function ParksIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3c-2.2 0-4 1.8-4 4 0 1.2.5 2.2 1.3 3H8l-3 4h6v6h2v-6h6l-3-4h-1.3C15.5 9.2 16 8.2 16 7c0-2.2-1.8-4-4-4Z" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function EducationIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10.5 12 6l8 4.5-8 4.5-8-4.5Z" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6 12v5c2 1.2 4 2 6 2s4-.8 6-2v-5" stroke="var(--icon-stroke)" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

export function IconTile(props: { icon: string }) {
  const Icon = props.icon === 'education' ? EducationIcon : ParksIcon
  return (
    <div
      style={{
        width: 68,
        height: 68,
        borderRadius: 'var(--radius-lg)',
        background: 'var(--icon-tile-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-hidden="true"
    >
      <Icon />
    </div>
  )
}
