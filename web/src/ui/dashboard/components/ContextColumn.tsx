import { LocalImpactNewsPanel } from './context/LocalImpactNewsPanel'
import { YourActivityPanel } from './context/YourActivityPanel'

export function ContextColumn(props: { cityState: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <YourActivityPanel signed={['Clean Energy for All']} following={['Public Education Funding']} />
      <LocalImpactNewsPanel
        cityState={props.cityState}
        items={[
          { id: 'n1', title: 'New parks proposal for [City]' },
          { id: 'n2', title: 'School funding town hall tonight' },
        ]}
      />
    </div>
  )
}
