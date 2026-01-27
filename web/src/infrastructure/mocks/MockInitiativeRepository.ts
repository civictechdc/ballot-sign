import type { InitiativeRepository, InitiativeListQuery } from '../../application/ports/InitiativeRepository'
import type { Initiative } from '../../domain/initiative/Initiative'

type CsvRow = Record<string, string>

let initiativesCache: Initiative[] | null = null
let initiativesPromise: Promise<Initiative[]> | null = null

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = []
  let current = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"') {
      const next = text[i + 1]
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === ',' && !inQuotes) {
      row.push(current)
      current = ''
      continue
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1
      }
      row.push(current)
      if (row.length > 1 || row.some((value) => value.trim() !== '')) {
        rows.push(row)
      }
      current = ''
      row = []
      continue
    }
    current += char
  }
  if (current.length || row.length) {
    row.push(current)
    rows.push(row)
  }

  if (!rows.length) return []
  const headers = rows[0].map((header) => header.trim())
  return rows.slice(1).map((values) => {
    const record: CsvRow = {}
    headers.forEach((header, index) => {
      record[header] = (values[index] ?? '').trim()
    })
    return record
  })
}

function parseJsonArray<T>(value: string, fallback: T[] = []): T[] {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

async function loadInitiatives(): Promise<Initiative[]> {
  if (initiativesCache) return initiativesCache
  if (initiativesPromise) return initiativesPromise

  const baseUrl = import.meta.env.BASE_URL ?? '/'
  const csvUrl = `${baseUrl}initiatives.csv`
  initiativesPromise = fetch(csvUrl)
    .then(async (resp) => {
      if (!resp.ok) throw new Error(`CSV fetch failed (${resp.status})`)
      const text = await resp.text()
      const rows = parseCsv(text)
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: (row.status || 'active') as Initiative['status'],
        signatureCount: Number(row.signatureCount || 0),
        signatureGoal: Number(row.signatureGoal || 0),
        signatureDeadlineISO: row.signatureDeadlineISO,
        createdAtISO: row.createdAtISO,
        summary: row.summary,
        textFirstParagraph: row.textFirstParagraph,
        topicTags: parseJsonArray<string>(row.topicTags, []),
        endorsements: parseJsonArray<{ by: string; quote?: string }>(row.endorsements, []),
        updates: parseJsonArray<{ dateISO: string; title: string; body: string }>(row.updates, []),
        forumComments: parseJsonArray<{ id: string; author: string; dateISO: string; body: string }>(row.forumComments, []),
        campaignManager: {
          displayName: row.campaignManagerDisplayName,
          handle: row.campaignManagerHandle,
        },
      }))
    })
    .catch(() => [])
    .then((items) => {
      initiativesCache = items
      initiativesPromise = null
      return items
    })

  return initiativesPromise
}

export class MockInitiativeRepository implements InitiativeRepository {
  async list(query?: InitiativeListQuery): Promise<Initiative[]> {
    const q = (query?.search ?? '').trim().toLowerCase()
    let items = [...(await loadInitiatives())]
    if (q) {
      items = items.filter((i) => i.title.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q))
    }
    if (query?.tags?.length) {
      items = items.filter((i) => query.tags!.every((t) => i.topicTags.includes(t)))
    }
    if (query?.sort === 'deadline') {
      items.sort((a, b) => a.signatureDeadlineISO.localeCompare(b.signatureDeadlineISO))
    } else {
      items.sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO))
    }
    return items
  }

  async getBySlug(slug: string) {
    const items = await loadInitiatives()
    return items.find((i) => i.slug === slug) ?? null
  }
}
