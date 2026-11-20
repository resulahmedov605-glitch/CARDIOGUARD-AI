import { useEffect, useState } from 'react'
import { Icon } from '../../components/Icon'
import { useApiResource } from '../../hooks/useApiResource'
import type { AlgorithmInfo, LabExecution, LabRequest, Operation } from '../../lib/algorithms'
import { AlgorithmVisualization } from './AlgorithmVisualization'
import './algorithms.css'

function numericList(text: string): number[] {
  if (!text.trim()) return []
  const values = text.split(',').map((value) => {
    if (!/^-?\d+$/.test(value.trim())) throw new Error('Values must be comma-separated integers.')
    return Number(value)
  })
  if (values.length > 24 || values.some((value) => value < -999 || value > 999)) throw new Error('Use up to 24 integers between −999 and 999.')
  return values
}

export default function AlgorithmsLab() {
  const catalog = useApiResource<AlgorithmInfo[]>('/api/v1/algorithms')
  const [category, setCategory] = useState('Sorting')
  const [selected, setSelected] = useState('bubble-sort')
  const items = catalog.data ?? []
  const info = items.find((item) => item.id === selected)
  function changeCategory(next: string) {
    setCategory(next)
    setSelected(items.find((item) => item.category === next)?.id ?? '')
  }
  return <>
    <div className="page-heading">
      <div>
        <div className="eyebrow">STEP-BY-STEP LEARNING</div>
        <h1>Algorithms Lab <Icon name="algorithm" className="page-title-icon" /></h1>
        <p>Change the input. Follow each operation. Compare the work.</p>
      </div>
      <span className="sprint-badge">Local Python execution</span>
    </div>
    {catalog.loading && <p role="status">Loading the algorithm catalog…</p>}
    {catalog.error && <div className="lab-error" role="alert"><p>{catalog.error}</p><button className="lab-button" onClick={catalog.retry}>Retry catalog</button></div>}
    {!!items.length && <>
      <div className="lab-selectors">
        <label>Category
          <select value={category} onChange={(event) => changeCategory(event.target.value)}>
            {[...new Set(items.map((item) => item.category))].map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>Algorithm or structure
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            {items.filter((item) => item.category === category).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      </div>
      {info && <Runner key={info.id} info={info} catalog={items} />}
    </>}
    <p className="lab-footnote">Educational algorithm demonstrations. Complexity describes working memory and computation, with input validation and recorded visualization traces counted separately.</p>
  </>
}

function ExecutionControls(props: {
  canRun: boolean; canPause: boolean; canReset: boolean; canStep: boolean
  speed: string; onSpeed: (speed: string) => void
  onRun: () => void; onPause: () => void; onReset: () => void; onStep: () => void
}) {
  return <div className="lab-controls" aria-label="Execution controls">
    <button className="primary-button" onClick={props.onRun} disabled={!props.canRun}>
      <Icon name="play" width={16} height={16} />Run
    </button>
    <button className="lab-button" disabled={!props.canPause} onClick={props.onPause}>Pause</button>
    <button className="lab-button" disabled={!props.canReset} onClick={props.onReset}>Reset</button>
    <button className="lab-button" disabled={!props.canStep} onClick={props.onStep}>Step Forward</button>
    <label>Animation speed
      <select value={props.speed} onChange={(event) => props.onSpeed(event.target.value)}>
        {['0.5', '1', '2', '4'].map((value) => <option key={value} value={value}>{value}x</option>)}
      </select>
    </label>
  </div>
}

function Runner({ info, catalog }: { info: AlgorithmInfo; catalog: AlgorithmInfo[] }) {
  const example = info.example
  const [values, setValues] = useState((example.values ?? []).join(', '))
  const [target, setTarget] = useState(String(example.target ?? 8))
  const [width, setWidth] = useState(String(example.window_size ?? 3))
  const [capacity, setCapacity] = useState(String(example.capacity ?? 8))
  const [nodes, setNodes] = useState((example.nodes ?? []).join(', '))
  const [edges, setEdges] = useState((example.edges ?? []).map((edge) => `${edge.source} ${edge.target} ${edge.weight}`).join('\n'))
  const [start, setStart] = useState(example.start_node ?? '')
  const [directed, setDirected] = useState(example.directed ?? false)
  const [operations, setOperations] = useState<Operation[]>(example.operations ?? [])
  const [action, setAction] = useState(info.operations[0]?.action ?? '')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [compare, setCompare] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [body, setBody] = useState<string>()
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState('1')
  const execution = useApiResource<LabExecution>(body ? '/api/v1/algorithms/execute' : null, body)
  const graph = info.visual === 'graph'
  const operation = info.operations.find((item) => item.action === action)
  const count = execution.data?.step_count ?? 0

  useEffect(() => {
    if (!playing || !execution.data) return
    if (index >= count - 1) { setPlaying(false); return }
    const timeout = window.setTimeout(() => setIndex((value) => Math.min(value + 1, count - 1)), 800 / Number(speed))
    return () => window.clearTimeout(timeout)
  }, [playing, execution.data, count, index, speed])

  function addOperation() {
    try {
      if (operations.length >= 24) throw new Error('Use at most 24 operations.')
      const next: Record<string, string | number> = { action }
      for (const field of operation?.fields ?? []) {
        const raw = draft[field]?.trim() ?? ''
        if (!raw) throw new Error(`Enter ${field} for ${action}.`)
        if (['value', 'index', 'priority', 'weight'].includes(field)) {
          const value = Number(raw)
          if (!Number.isFinite(value)) throw new Error(`${field} must be finite.`)
          if (['value', 'index'].includes(field) && !Number.isInteger(value)) throw new Error(`${field} must be an integer.`)
          next[field] = value
        } else next[field] = raw
      }
      setOperations([...operations, next as Operation])
      setError(null)
    } catch (error) { setError(error instanceof Error ? error.message : 'Invalid operation.') }
  }

  function run() {
    try {
      const request: LabRequest = { algorithm: info.id, compare, operations }
      if (graph) {
        request.nodes = nodes.trim() ? nodes.split(',').map((value) => value.trim()) : []
        request.edges = edges.trim() ? edges.trim().split('\n').map((line) => {
          const fields = line.trim().split(/\s+/)
          if (fields.length < 2 || fields.length > 3) throw new Error('Each edge needs source, target and an optional weight.')
          const weight = fields[2] === undefined ? 1 : Number(fields[2])
          if (!Number.isFinite(weight)) throw new Error('Edge weights must be finite numbers.')
          return { source: fields[0], target: fields[1], weight }
        }) : []
        request.start_node = start.trim() || null
        request.directed = directed
      } else request.values = numericList(values)
      if (info.id === 'binary-search') {
        if (!target.trim() || !Number.isInteger(Number(target))) throw new Error('Enter an integer target.')
        request.target = Number(target)
      }
      if (info.id === 'sliding-window') {
        if (!width.trim() || !Number.isInteger(Number(width))) throw new Error('Enter an integer window size.')
        request.window_size = Number(width)
      }
      if (['hash-table', 'circular-queue'].includes(info.id)) {
        if (!capacity.trim() || !Number.isInteger(Number(capacity))) throw new Error('Enter an integer capacity.')
        request.capacity = Number(capacity)
      }
      const next = JSON.stringify(request)
      setError(null)
      if (next === body && execution.data) {
        if (index >= count - 1) setIndex(0)
      } else {
        setIndex(0)
        setBody(next)
        if (next === body) execution.retry()
      }
      setPlaying(true)
    } catch (error) { setError(error instanceof Error ? error.message : 'Invalid input.') }
  }

  return <>
    <section className="lab-introduction">
      <h2>{info.name}</h2>
      <p>{info.description}</p>
      <div className="lab-complexities">
        <span><strong>Time</strong> {info.time}</span>
        <span><strong>Space</strong> {info.space}</span>
      </div>
    </section>
    <div className="lab-layout">
      <section className="lab-panel lab-inputs" aria-labelledby="lab-input-title">
        <h2 id="lab-input-title">Input configuration</h2>
        {graph ? <>
          <label>Nodes
            <input value={nodes} onChange={(event) => setNodes(event.target.value)} placeholder="A, B, C" />
          </label>
          <label>Edges
            <textarea rows={5} value={edges} onChange={(event) => setEdges(event.target.value)} />
          </label>
          <p className="lab-hint">One edge per line · source target weight. Up to 12 nodes and 32 edges.</p>
          {info.id !== 'graph' && <label>Start node
            <input value={start} onChange={(event) => setStart(event.target.value)} />
          </label>}
          <label className="lab-check">
            <input type="checkbox" checked={directed} onChange={(event) => setDirected(event.target.checked)} /> Directed graph
          </label>
        </> : <div className="lab-values-input">
          <label htmlFor="lab-values">Values</label>
          <input id="lab-values" aria-describedby="lab-values-hint" value={values} onChange={(event) => setValues(event.target.value)} />
          <p id="lab-values-hint" className="lab-hint">Comma-separated integers · up to 24 values.</p>
        </div>}
        {info.id === 'binary-search' && <label>Target
          <input type="number" value={target} onChange={(event) => setTarget(event.target.value)} />
        </label>}
        {info.id === 'sliding-window' && <label>Window size
          <input type="number" min="1" max="24" value={width} onChange={(event) => setWidth(event.target.value)} />
        </label>}
        {['circular-queue', 'hash-table'].includes(info.id) && <label>Capacity
          <input type="number" min="1" max="16" value={capacity} onChange={(event) => setCapacity(event.target.value)} />
        </label>}
        {!!info.operations.length && <>
          <label>Operation
            <select value={action} onChange={(event) => { setAction(event.target.value); setDraft({}) }}>
              {info.operations.map((item) => <option key={item.action}>{item.action}</option>)}
            </select>
          </label>
          <div className="lab-operation-fields">
            {operation?.fields.map((field) => <label key={field}>{field}
              <input aria-label={`Operation ${field}`} value={draft[field] ?? ''}
                onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} />
            </label>)}
          </div>
          <button className="lab-button" onClick={addOperation}>Add operation</button>
          <ol className="lab-operation-list" aria-label="Queued operations">
            {operations.map((item, position) => <li key={position}>
              <code>{JSON.stringify(item)}</code>
              <button aria-label={`Remove operation ${position + 1}`}
                onClick={() => setOperations(operations.filter((_, index) => index !== position))}>×</button>
            </li>)}
          </ol>
          <p className="lab-hint">Queued operations execute when you run. Underflow and overflow appear as operation-error steps.</p>
        </>}
        {info.category === 'Sorting' && <label className="lab-check">
          <input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} />
          Compare Bubble Sort and Merge Sort
        </label>}
        <p className="lab-hint">Input changes apply on Run.</p>
        {error && <p role="alert" className="lab-validation">{error}</p>}
      </section>

      <div className="lab-workspace">
        <ExecutionControls
          canRun={!execution.loading && (!playing || !!execution.error)}
          canPause={playing && !!execution.data}
          canReset={!!execution.data && !execution.loading}
          canStep={!!execution.data && !playing && index < count - 1}
          speed={speed} onSpeed={setSpeed} onRun={run}
          onPause={() => setPlaying(false)}
          onReset={() => { setPlaying(false); setIndex(0) }}
          onStep={() => setIndex((value) => Math.min(value + 1, count - 1))}
        />
        {execution.loading && <p className="lab-empty" role="status">Python is recording the execution steps…</p>}
        {execution.error && <div className="lab-error" role="alert"><p>{execution.error}</p><button className="lab-button" onClick={() => { setIndex(0); execution.retry() }}>Retry execution</button></div>}
        {!body && <p className="lab-empty">Configure the input and press Run to generate a real execution trace.</p>}
        {execution.data && <>
          <p className="lab-playback-status" role="status">
            Step {Math.min(index + 1, count)} of {count} · {index >= count - 1 ? 'Complete' : playing ? 'Running' : 'Paused'}
          </p>
          <div className={execution.data.runs.length > 1 ? 'lab-run-grid comparing' : 'lab-run-grid'}>
            {execution.data.runs.map((run) => {
              const metadata = catalog.find((entry) => entry.id === run.algorithm)!
              const currentIndex = Math.min(index, run.steps.length - 1)
              const step = run.steps[currentIndex]
              const done = currentIndex === run.steps.length - 1
              return <section className="lab-panel lab-run" key={run.algorithm} aria-label={`${metadata.name} execution`}>
                <div className="lab-run-heading">
                  <h2>{metadata.name}</h2><span>{run.steps.length} recorded steps</span>
                </div>
                <AlgorithmVisualization info={metadata} step={step} />
                <p className={step.error ? 'lab-current-step lab-validation' : 'lab-current-step'} aria-live="polite">
                  {step.message}
                </p>
                <div className="lab-pseudocode">
                  <h3>Pseudocode</h3>
                  <ol>{metadata.pseudocode.map((line, position) => (
                    <li key={position} aria-current={step.line === position + 1 ? 'step' : undefined}>
                      <code>{line}</code>
                    </li>
                  ))}</ol>
                </div>
                <details className="lab-details">
                  <summary>Execution log</summary>
                  <ol className="lab-log">{run.steps.slice(0, currentIndex + 1).map((entry, position) => (
                    <li key={position} className={entry.error ? 'lab-validation' : ''}>
                      {position + 1}. {entry.message}
                    </li>
                  ))}</ol>
                </details>
                {done && <>
                  {Array.isArray(run.result.errors) && run.result.errors.length > 0 && <p className="lab-error" role="alert">Completed with {run.result.errors.length} operation error(s). Inspect the returned error messages below.</p>}
                  <dl className="lab-metrics" aria-label={`${metadata.name} recorded work`}>
                    {Object.entries(run.metrics).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
                  </dl>
                  <details className="lab-details" open>
                    <summary>Result and returned values</summary>
                    <pre className="lab-result">{JSON.stringify(run.result, null, 2)}</pre>
                  </details>
                </>}
                {compare && <p className="lab-chart-note">Time · {metadata.time}<br />Space · {metadata.space}</p>}
              </section>
            })}
          </div>
        </>}
      </div>
    </div>
    <section className="lab-panel lab-education" aria-label="Algorithm explanation">
      <h2>How {info.name} works</h2>
      <p>{info.how}</p>
      <dl>
        <div><dt>Input</dt><dd>{info.input}</dd></div>
        <div><dt>Output</dt><dd>{info.output}</dd></div>
        <div><dt>Advantages</dt><dd>{info.advantages}</dd></div>
        <div><dt>Limitations</dt><dd>{info.limitations}</dd></div>
        <div><dt>Conceptual application</dt><dd>{info.use_case}</dd></div>
      </dl>
      {!!info.operations.length && <table>
        <caption>Operation complexity</caption>
        <thead><tr><th>Operation</th><th>Time</th></tr></thead>
        <tbody>{info.operations.map((operation) => (
          <tr key={operation.action}><td>{operation.action}</td><td>{operation.time}</td></tr>
        ))}</tbody>
      </table>}
    </section>
  </>
}
