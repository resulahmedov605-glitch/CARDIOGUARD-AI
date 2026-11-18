import { useCallback, useState } from 'react'
import { Icon } from '../../components/Icon'
import { anatomyGroups, circulation, defaultLayers, structures } from './anatomy'
import type { AnatomyLayers, LayerId, StructureId } from './anatomy'
import { HeartViewer } from './HeartViewer'
import './heart.css'

export default function HeartExplorer() {
  const [selected, setSelected] = useState<StructureId | null>(null)
  const [group, setGroup] = useState<LayerId>('chambers')
  const [layers, setLayers] = useState<AnatomyLayers>({ ...defaultLayers })
  const structure = structures.find((item) => item.id === selected)
  const chooseStructure = useCallback((id: StructureId | null) => {
    setSelected(id)
    const entry = structures.find((item) => item.id === id)
    if (entry) {
      setGroup(entry.layer)
      setLayers((current) => current[entry.layer] ? current : { ...current, [entry.layer]: true })
    }
  }, [])
  function changeLayers(next: AnatomyLayers) {
    setLayers(next)
    if (structure && !next[structure.layer]) setSelected(null)
    if (!next.chambers && !next.vessels && next.interior) setGroup('interior')
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">INTERACTIVE ANATOMY</div>
          <h1>3D Heart Explorer <Icon name="heart" className="page-title-icon" /></h1>
          <p>Explore the chambers, follow the vessels and look inside the heart.</p>
        </div>
        <span className="sprint-badge"><Icon name="layers" width={16} height={16} /> Local 3D model</span>
      </div>

      <div className="heart-layout">
        <HeartViewer selected={selected} onSelect={chooseStructure} layers={layers} onLayersChange={changeLayers} />
        <aside className="heart-sidebar" aria-label="Anatomical information">
          <section className="heart-panel" aria-labelledby="chamber-list-title">
            <h2 id="chamber-list-title">Explore anatomy</h2>
            <p className="heart-panel-intro">Hover for a quick label. Click to explore a structure.</p>
            <div className="heart-category-buttons" role="group" aria-label="Anatomy groups">
              {anatomyGroups.map((category) => (
                <button key={category.id} aria-pressed={group === category.id} onClick={() => setGroup(category.id)}>{category.name}</button>
              ))}
            </div>
            <div className="heart-structure-list">
              {structures.filter((item) => item.layer === group).map((item) => (
                <button key={item.id} aria-pressed={selected === item.id} onClick={() => chooseStructure(item.id)}>
                  <Icon name="heart" width={17} height={17} />
                  {item.name}
                  <Icon name="chevron" width={16} height={16} />
                </button>
              ))}
            </div>
            {selected && <button className="heart-clear" onClick={() => chooseStructure(null)}>Show whole heart</button>}
          </section>
          <section className="heart-panel heart-description" aria-live="polite" aria-atomic="true" aria-label="Selected structure">
            {structure ? (
              <>
                <span className="heart-section-label">SELECTED STRUCTURE</span>
                <h2>{structure.name}</h2>
                <p>{structure.description}</p>
                <h3>Function</h3>
                <p>{structure.function}</p>
                <p className="heart-pathway">{structure.pathway}</p>
              </>
            ) : (
              <>
                <Icon name="heart" className="text-primary" width={28} height={28} />
                <h2>Inside the human heart</h2>
                <p>Explore {structures.length} anatomical structures across chamber walls, blood vessels and internal anatomy.</p>
                <p>Use View inside to reveal the valves, septum and papillary muscles.</p>
              </>
            )}
            <p className="heart-orientation">Left and right refer to the person's body. Selected structures stay solid while surrounding anatomy fades. Vessel colors aid identification.</p>
          </section>
        </aside>
      </div>

      <section className="heart-panel heart-circulation" aria-labelledby="circulation-title">
        <div className="heart-section-heading">
          <Icon name="algorithm" width={20} height={20} />
          <h2 id="circulation-title">The circulation pathway</h2>
        </div>
        <p>Blood travels through the lungs to receive oxygen, then returns to the heart for delivery to the body.</p>
        <ol className="heart-flow">
          {circulation.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
        </ol>
        <details className="heart-vessels">
          <summary>Major vessels and valves</summary>
          <dl>
            <div><dt>Aorta</dt><dd>Carries oxygen-rich blood from the left ventricle into the body's systemic circulation.</dd></div>
            <div><dt>Pulmonary arteries</dt><dd>Carry blood from the right ventricle to the lungs, where gas exchange occurs.</dd></div>
            <div><dt>Pulmonary veins</dt><dd>Return oxygen-rich blood from the lungs to the left atrium.</dd></div>
            <div><dt>Venae cavae</dt><dd>Return oxygen-poor blood from the body to the right atrium.</dd></div>
            <div><dt>Heart valves</dt><dd>The tricuspid, pulmonary, mitral and aortic valves help maintain forward blood flow.</dd></div>
          </dl>
        </details>
        <p className="heart-source-note">
          Vessel groups include the cardiac segments supplied by the atlas. The layer controls
          reveal the chamber walls, vessels, valves, septum and papillary muscles.
        </p>
        <a className="heart-source-link" href="https://www.nhlbi.nih.gov/health/heart/blood-flow" target="_blank" rel="noreferrer">
          Anatomy and circulation reference · NIH/NHLBI <Icon name="external" width={13} height={13} />
        </a>
      </section>

      <div className="heart-attribution">
        <p>Models by Kristen Browne and Heidi Schlehlein · HuBMAP Human Reference Atlas · Heart and Blood Vasculature, Female v1.3.</p>
        <p>
          <a href="https://purl.humanatlas.io/ref-organ/heart-female/v1.3" target="_blank" rel="noreferrer">Model source</a>
          {' · '}<a href="/models/heart/LICENSE.txt" target="_blank" rel="noreferrer">CC BY 4.0</a>
          {' · '}<a href="/models/heart/source.json" target="_blank" rel="noreferrer">Asset provenance</a>
          {' · '}<a href="/models/heart/vessels-source.json" target="_blank" rel="noreferrer">Vessel provenance</a>
        </p>
        <p>Display adaptations include framing, lighting and selection colors. Educational reference anatomy.</p>
      </div>
    </>
  )
}
