import { Hero } from './components/Hero'
import { SearchAndFilters } from './components/SearchAndFilters'
import { MainGrid } from './components/MainGrid'

/**
 * Ballot Initiative Dashboard page.
 *
 * Component hierarchy MUST match the spec:
 * AppShell > Header > Hero > SearchAndFilters > MainGrid.
 */
export function DashboardPage() {
  return (
    <>
      <Hero cityState="[City, State]" name="Alex" topics={['Environment', 'Education']} />
      <SearchAndFilters locationLabel="[City, State]" topics={['Environment', 'Education']} />
      <MainGrid cityState="[City, State]" />
    </>
  )
}
