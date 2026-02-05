import type { ReactNode } from 'react'

export function SectionHeader(props: { title: string; rightAdornment?: ReactNode; size?: 'default' | 'small' }) {
  const isSmall = props.size === 'small'
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
      }}
    >
      <h2
        className="serif"
        style={{
          margin: 0,
          fontSize: isSmall ? 24 : 30,
          lineHeight: 1.1,
          fontWeight: 700,
          color: 'var(--text-primary)',
        }}
      >
        {props.title}
      </h2>
      {props.rightAdornment ? <div aria-hidden="true">{props.rightAdornment}</div> : null}
    </div>
  )
}
