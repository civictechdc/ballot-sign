import { useState } from 'react'

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="#666666"
        strokeWidth="2"
      />
      <path d="M16.5 16.5 21 21" stroke="#666666" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function SearchAndFilters(props: { locationLabel: string; topics: string[] }) {
  const [value, setValue] = useState('')
  return (
    <section style={{ maxWidth: 800, margin: '0 auto 40px' }}>
      <form
        onSubmit={(e) => e.preventDefault()}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 48,
          padding: '12px 16px',
          border: '1px solid var(--border-input)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)',
        }}
        aria-label="Initiative search"
      >
        <span style={{ marginRight: 12, display: 'inline-flex' }}>
          <SearchIcon />
        </span>
        <input
          className="sans"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search for Initiatives by Topic, State, or Keywords"
          aria-label="Search for Initiatives by Topic, State, or Keywords"
          style={{
            border: 'none',
            outline: 'none',
            padding: 0,
            width: '100%',
            fontSize: 16,
          }}
        />
      </form>

      <div className="sans" style={{ marginTop: 16, fontSize: 15, color: 'var(--text-primary)' }}>
        Filter: {props.locationLabel} (Selected) [Topics] ({props.topics.join(', ')})
      </div>
    </section>
  )
}
