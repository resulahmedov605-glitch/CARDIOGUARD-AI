import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { createHeartScene } from './heart-scene'
import type { AnatomyHover, HeartScene } from './heart-scene'
import { anatomyGroups, defaultLayers, structures } from './anatomy'
import type { AnatomyLayers, StructureId } from './anatomy'

export function HeartViewer({ selected, onSelect, layers, onLayersChange }: {
  selected: StructureId | null
  onSelect: (id: StructureId | null) => void
  layers: AnatomyLayers
  onLayersChange: (layers: AnatomyLayers) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<HeartScene | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState({ phase: 'loading', message: '' })
  const [hover, setHover] = useState<AnatomyHover | null>(null)

  useEffect(() => {
    if (!host.current) return
    setStatus({ phase: 'loading', message: '' })
    setHover(null)
    try {
      scene.current = createHeartScene(host.current, onSelect,
        () => setStatus({ phase: 'ready', message: '' }),
        (message) => setStatus({ phase: 'error', message }),
        setHover,
      )
    } catch {
      setStatus({ phase: 'error', message: '3D graphics are unavailable. Enable WebGL or try a browser with hardware acceleration. The anatomy guide is available below.' })
    }
    return () => {
      scene.current?.dispose()
      scene.current = null
    }
  }, [attempt, onSelect])

  useEffect(() => {
    if (status.phase !== 'ready') return
    scene.current?.setLayers(layers)
    scene.current?.select(selected)
  }, [selected, status.phase, layers])

  const ready = status.phase === 'ready'
  const hovered = structures.find((structure) => structure.id === hover?.id)
  const inside = !layers.chambers && !layers.vessels
  return (
    <section className="heart-viewer" aria-labelledby="heart-model-title">
      <div className="heart-panel-heading">
        <div>
          <h2 id="heart-model-title">Human heart</h2>
          <p>Female reference organ · HuBMAP HRA</p>
        </div>
        {ready && <span className="heart-ready"><Icon name="success" width={15} height={15} /> Model loaded</span>}
      </div>
      <div className="heart-layer-controls" role="group" aria-label="Anatomy layers">
        {anatomyGroups.map((group) => (
          <label key={group.id}>
            <input type="checkbox" checked={layers[group.id]}
              onChange={() => onLayersChange({ ...layers, [group.id]: !layers[group.id] })} />
            {group.layerName}
          </label>
        ))}
        <button type="button" className="heart-tool" disabled={!ready} aria-pressed={inside}
          onClick={() => onLayersChange(inside ? { ...defaultLayers } : { chambers: false, vessels: false, interior: true })}>
          <Icon name="layers" width={16} height={16} />{inside ? 'Surface view' : 'View inside'}
        </button>
      </div>
      <div className="heart-stage" aria-busy={status.phase === 'loading'}>
        <div className="heart-canvas" ref={host} />
        {ready && hover && hovered && (
          <div className="heart-tooltip" role="tooltip"
            style={{
              left: Math.max(12, Math.min(hover.x + 16, (host.current?.clientWidth ?? 300) - 252)),
              top: Math.max(12, Math.min(hover.y + 16, (host.current?.clientHeight ?? 440) - 160)),
            }}>
            <strong>{hovered.name}</strong>
            <p>{hovered.description}</p>
            <span>Click to explore</span>
          </div>
        )}
        {ready && !Object.values(layers).some(Boolean) && (
          <div className="heart-view-message heart-empty-layers" role="status">
            <p>All layers are hidden. Enable a layer to view the anatomy.</p>
          </div>
        )}
        {status.phase === 'loading' && (
          <div className="heart-view-message" role="status">
            <Icon name="loading" className="animate-spin" width={28} height={28} />
            <strong>Loading anatomical model…</strong>
          </div>
        )}
        {status.phase === 'error' && (
          <div className="heart-view-message" role="alert">
            <Icon name="warning" width={30} height={30} />
            <strong>Heart viewer unavailable</strong>
            <p>{status.message}</p>
            <button type="button" className="heart-tool" onClick={() => setAttempt((value) => value + 1)}>
              <Icon name="refresh" width={16} height={16} /> Reload viewer
            </button>
          </div>
        )}
      </div>
      <div className="heart-toolbar" aria-label="3D view controls">
        <div>
          <button className="heart-tool" disabled={!ready} onClick={() => scene.current?.rotate(-.25)} aria-label="Rotate left">
            <Icon name="reset" width={18} height={18} />
          </button>
          <button className="heart-tool" disabled={!ready} onClick={() => scene.current?.rotate(.25)} aria-label="Rotate right">
            <Icon name="refresh" width={18} height={18} />
          </button>
          <button className="heart-tool" disabled={!ready} onClick={() => scene.current?.zoom(.8)} aria-label="Zoom in">
            <Icon name="zoomIn" width={18} height={18} />
          </button>
          <button className="heart-tool" disabled={!ready} onClick={() => scene.current?.zoom(1.25)} aria-label="Zoom out">
            <Icon name="zoomOut" width={18} height={18} />
          </button>
        </div>
        <button className="heart-tool" disabled={!ready} onClick={() => scene.current?.reset()}>
          <Icon name="reset" width={16} height={16} /> Reset view
        </button>
      </div>
      <p className="heart-help" id="heart-controls-help">
        Drag to rotate · scroll or pinch to zoom · right-drag or two fingers to pan.
        Focus the model to use arrow keys, + / − and Home.
        Hide chamber walls to explore valves and muscles.
      </p>
    </section>
  )
}
