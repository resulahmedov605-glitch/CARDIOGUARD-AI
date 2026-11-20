import { useEffect, useId, useRef, useState } from 'react'
import type { AlgorithmInfo, LabStep } from '../../lib/algorithms'

function GraphView({ step, heap }: { step: LabStep; heap: boolean }) {
  const marker = useId().replace(/:/g, '')
  const container = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(640)
  const { state } = step
  const nodes = heap ? state.values.map((value, index) => ({
    id: String(index), label: `${value} (${state.priorities[index]})`,
    depth: Math.floor(Math.log2(index + 1)), x: null,
  })) : state.nodes
  const tree = heap || nodes.some((node) => node.depth !== null)
  useEffect(() => {
    if (!container.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setAvailable(container.current!.clientWidth - 24))
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [nodes.length])
  const width = tree ? Math.max(640, nodes.length * 34) : Math.max(300, available)
  const depth = Math.max(0, ...nodes.map((node) => node.depth ?? 0))
  const height = tree ? Math.max(280, (depth + 1) * 76) : 360
  const points = nodes.map((node, index) => {
    if (!tree) {
      const angle = -Math.PI / 2 + index * 2 * Math.PI / nodes.length
      return { ...node, px: width / 2 + Math.cos(angle) * (width / 2 - 40), py: height / 2 + Math.sin(angle) * 132 }
    }
    const level = node.depth ?? 0
    const slot = index - (2 ** level - 1)
    const x = heap ? (slot + .5) / 2 ** level : (state.values.indexOf(Number(node.id)) + 1) / (nodes.length + 1)
    return { ...node, px: 24 + x * (width - 48), py: 38 + level * 76 }
  })
  const edges = heap ? nodes.slice(1).map((_, index) => ({ source: String(Math.floor(index / 2)), target: String(index + 1), weight: null })) : state.edges
  if (!nodes.length) return <p className="lab-empty">The graph or tree is empty.</p>
  return (
    <div className="lab-graph-scroll" ref={container}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: tree ? width : undefined, height }} role="img" aria-label={heap ? 'Current priority queue heap' : 'Current graph or tree'}>
        <defs><marker id={marker} viewBox="0 0 10 10" refX="23" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
        {edges.map((edge) => {
          const source = points.find((point) => point.id === edge.source)!
          const target = points.find((point) => point.id === edge.target)!
          const path = step.path_edges.some((path) => (path.source === edge.source && path.target === edge.target) || (!state.directed && path.source === edge.target && path.target === edge.source))
          if (!source || !target) return null
          return <g key={`${edge.source}-${edge.target}`} className={path ? 'lab-path-edge' : 'lab-edge'}>
            {source.id === target.id ? <path d={`M ${source.px - 15} ${source.py - 15} c -55 -70 85 -70 30 0`} fill="none" /> : <line x1={source.px} y1={source.py} x2={target.px} y2={target.py} markerEnd={state.directed ? `url(#${marker})` : undefined} />}
            {edge.weight != null && <text x={(source.px + target.px) / 2 + 7} y={(source.py + target.py) / 2 - 7}>{edge.weight}</text>}
          </g>
        })}
        {points.map((point) => <g key={point.id} className={step.current === point.id ? 'lab-node current' : step.visited.includes(point.id) ? 'lab-node visited' : 'lab-node'}>
          <title>{point.label}</title>
          <circle cx={point.px} cy={point.py} r={23} />
          <text x={point.px} y={point.py + 4}>{point.label.length > 8 ? `${point.label.slice(0, 7)}…` : point.label}</text>
        </g>)}
      </svg>
    </div>
  )
}

export function AlgorithmVisualization({ info, step }: { info: AlgorithmInfo; step: LabStep }) {
  const { state } = step
  const max = Math.max(1, ...state.values.map(Math.abs))
  if (['graph', 'tree', 'priority'].includes(info.visual)) return <>
    <GraphView step={step} heap={info.visual === 'priority'} />
    <p className="lab-chart-note">Current · {step.current ?? '—'} · Red outlines mark the current node, green outlines mark visited nodes.</p>
    {info.visual === 'priority' && <p className="lab-chart-note">Node labels show value (priority). The diagram follows heap array order.</p>}
    {step.visited.length > 0 && <p className="lab-chart-note">Visit order · {step.visited.join(' → ')}</p>}
    {step.frontier.length > 0 && <p className="lab-chart-note">{info.id === 'dfs' ? 'Call stack' : 'Frontier'} · {step.frontier.join(' → ')}</p>}
    {Object.keys(step.distances).length > 0 && <dl className="lab-distances" aria-label="Tentative distances">{Object.entries(step.distances).map(([node, value]) => <div key={node}><dt>{node}</dt><dd>{value ?? '∞'}</dd></div>)}</dl>}
    {info.id === 'dijkstra' && <p className="lab-chart-note">Highlighted edges show current predecessors. Distances become final as nodes settle.</p>}
  </>
  if (info.visual === 'hash') return <div className="lab-buckets" aria-label="Hash table buckets">
    {state.buckets.map((bucket, index) => <div key={index}><span>Bucket {index}</span><ol>{bucket.map((entry) => <li key={entry.key}>{entry.key} <strong>{entry.value}</strong></li>)}{!bucket.length && <li className="lab-muted">Empty</li>}</ol></div>)}
  </div>
  if (info.visual === 'circular') return <>
    <div className="lab-cells" aria-label="Circular queue slots">{state.slots.map((value, index) => <div className="lab-cell" key={index}><span>Slot {index}</span><strong>{value ?? '∅'}</strong><small>{state.head === index ? 'Head ' : ''}{state.tail === index ? 'Tail' : ''}</small></div>)}</div>
    <p className="lab-chart-note">{state.values.length} / {state.slots.length} occupied · Head is the next read, tail the next write.</p>
  </>
  if (['bars', 'search', 'window'].includes(info.visual)) return <>
    {!state.values.length && <p className="lab-empty">The array is empty.</p>}
    <div className="lab-bars" role="list" aria-label="Current array">
      {state.values.map((value, index) => {
        const outside = step.range !== null && (index < step.range[0] || index > step.range[1])
        return <div key={index} role="listitem" aria-label={`Index ${index}, value ${value}`}
          className={`lab-bar-cell${step.active.includes(index) ? ' active' : ''}${step.completed.includes(index) ? ' completed' : ''}${outside ? ' outside' : ''}`}>
          <div className="lab-bar-track"><div className={`lab-bar${value < 0 ? ' negative' : ''}`} style={{ height: `${Math.max(1, Math.abs(value) / max * 44)}%` }} /><span>{value}</span></div>
          <small>{index}</small>
        </div>
      })}
    </div>
    {step.range && <p className="lab-chart-note">{step.range[0] > step.range[1] ? 'The active range is empty.' : `Active range · ${step.range[0]}–${step.range[1]} (inclusive)`}</p>}
  </>
  return <>
    <p className="lab-chart-note">{info.visual === 'stack' ? 'Top → bottom' : info.visual === 'queue' ? 'Front → rear' : info.visual === 'linked-list' ? 'Head → next node' : 'Indexed storage'}</p>
    <div className={`lab-cells${info.visual === 'stack' ? ' lab-stack' : ''}${info.visual === 'linked-list' ? ' lab-links' : ''}`} aria-label="Current structure">
      {state.values.map((value, index) => <div className="lab-cell" key={index}><span>{info.visual === 'stack' && index === 0 ? 'Top' : index}</span><strong>{value}</strong></div>)}
      {!state.values.length && <p className="lab-empty">The structure is empty.</p>}
    </div>
  </>
}
