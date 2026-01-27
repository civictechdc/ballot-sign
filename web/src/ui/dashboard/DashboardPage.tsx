import { Hero } from './components/Hero'
import { SearchAndFilters } from './components/SearchAndFilters'
import { MainGrid } from './components/MainGrid'
import { useLegislativeBody } from '../legislativeBodies'

/**
 * Ballot Initiative Dashboard page.
 *
 * Component hierarchy MUST match the spec:
 * AppShell > Header > Hero > SearchAndFilters > MainGrid.
 */
export function DashboardPage() {
  const { body: legislativeBody } = useLegislativeBody()
  return (
    <>
      <Hero cityState={legislativeBody} name="Alex" topics={['Environment', 'Education']} />
      <SearchAndFilters locationLabel={legislativeBody} topics={['Environment', 'Education']} />
      <MainGrid cityState={legislativeBody} />
    </>
  )
}
