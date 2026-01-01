import type { Initiative } from '../../domain/initiative/Initiative'

export const mockInitiatives: Initiative[] = [
  {
    id: 'init_001',
    slug: 'safer-streets-2026',
    title: 'Safer Streets Initiative (2026)',
    status: 'active',
    signatureCount: 1842,
    signatureGoal: 25000,
    signatureDeadlineISO: '2026-05-15',
    createdAtISO: '2025-11-20',
    summary:
      'A proposal to expand protected bike lanes, improve crosswalk visibility, and fund Vision Zero infrastructure upgrades across the District.',
    textFirstParagraph:
      'The people of the District of Columbia find that traffic violence is preventable and that safe street design saves lives; therefore, the District shall prioritize street safety investments in a transparent and equitable manner.',
    topicTags: ['transportation', 'public-safety', 'vision-zero'],
    endorsements: [
      { by: 'DC Safe Streets Coalition', quote: 'This is a practical step toward eliminating traffic deaths.' },
      { by: 'Ward 4 Neighbors Association' },
    ],
    updates: [
      {
        dateISO: '2025-12-05',
        title: 'Kickoff canvass results',
        body: 'First weekend canvass collected 300+ pledges to sign.'
      },
      {
        dateISO: '2025-12-20',
        title: 'FAQ published',
        body: 'We added a plain-language FAQ and clarified how signature verification works.'
      },
    ],
    forumComments: [
      { id: 'c1', author: 'Alex R.', dateISO: '2025-12-06', body: 'How will this be funded?' },
      { id: 'c2', author: 'Morgan S.', dateISO: '2025-12-08', body: 'Strongly support safer crosswalks near schools.' },
    ],
    campaignManager: { displayName: 'Safer Streets DC', handle: 'saferstreetsdc' },
  },
  {
    id: 'init_002',
    slug: 'clean-river-initiative',
    title: 'Clean River Initiative',
    status: 'active',
    signatureCount: 512,
    signatureGoal: 20000,
    signatureDeadlineISO: '2026-06-30',
    createdAtISO: '2025-12-10',
    summary:
      'A proposal to increase stormwater mitigation funding and require real-time reporting of major combined sewer overflow events.',
    textFirstParagraph:
      'The people of the District of Columbia declare that clean water is essential for public health and environmental justice; therefore, the District shall strengthen stormwater controls and public reporting requirements.',
    topicTags: ['environment', 'water', 'transparency'],
    endorsements: [{ by: 'Anacostia Riverkeeper' }],
    updates: [{ dateISO: '2025-12-28', title: 'Petition text finalized', body: 'Legal review completed and text posted.' }],
    forumComments: [{ id: 'c3', author: 'Jamie T.', dateISO: '2025-12-29', body: 'Please add references to current CSO levels.' }],
    campaignManager: { displayName: 'Clean Water Now', handle: 'cleanwaternow' },
  },
]
