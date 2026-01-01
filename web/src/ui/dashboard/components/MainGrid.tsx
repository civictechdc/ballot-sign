import { RecommendedColumn } from './RecommendedColumn'
import { ContextColumn } from './ContextColumn'

export function MainGrid(props: { cityState: string }) {
  return (
    <section className="dashboard-grid">
      <RecommendedColumn />
      <ContextColumn cityState={props.cityState} />
    </section>
  )
}
