import { RecommendedColumn } from './RecommendedColumn'
import { ContextColumn } from './ContextColumn'

export function MainGrid(props: { 
  cityState: string
  onSignInitiative?: (initiative: {id: string, title: string}) => void 
}) {
  return (
    <section className="dashboard-grid">
      <RecommendedColumn onSignInitiative={props.onSignInitiative} />
      <ContextColumn cityState={props.cityState} />
    </section>
  )
}
