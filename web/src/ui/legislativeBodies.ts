import { useEffect, useState } from 'react'

export const LEGISLATIVE_BODIES = [
  'US House of Representatives',
  'US Senate',
  'Maryland General Assembly',
  'Baltimore City Council',
  'DC Council',
  'Virginia General Assembly',
  'Pennsylvania General Assembly',
  'New York State Legislature',
  'California State Legislature',
  'Texas Legislature',
]

const STORAGE_KEY = 'legislative.body'
const DEFAULT_BODY = 'US House of Representatives'

export function getLegislativeBody(): string {
  if (typeof window === 'undefined') return DEFAULT_BODY
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_BODY
}

export function setLegislativeBody(value: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, value)
}

export function useLegislativeBody() {
  const [body, setBody] = useState<string>(() => getLegislativeBody())

  useEffect(() => {
    setLegislativeBody(body)
  }, [body])

  return { body, setBody }
}
