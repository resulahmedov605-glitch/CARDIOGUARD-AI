import { useEffect, useRef, useState } from 'react'
import Plotly from 'plotly.js'
import createPlotlyComponent from 'react-plotly.js/factory'
import type { ECGSignalResponse } from '../../lib/ecg'
import type { ECGAnalysis } from '../../lib/analysis'
import type { Data } from 'plotly.js'
import { useTheme } from '../../hooks/useTheme'
import { Icon } from '../../components/Icon'
import { notify } from '../../lib/notifications'

const Plot = createPlotlyComponent(Plotly)

export default function ECGChart({ signal, analysis }: { signal: ECGSignalResponse; analysis?: ECGAnalysis }) {
  const { theme } = useTheme()
  const colors = theme === 'dark'
    ? { surface: '#1B1820', text: '#DACFD6', grid: '#3C323B', zero: '#65525F', original: '#FB7185', filtered: '#7DB2FF', peaks: '#C4B5FD', normalized: '#5EEAD4' }
    : { surface: '#FFFFFF', text: '#475569', grid: '#E8EEF5', zero: '#CBD5E1', original: '#E24B4B', filtered: '#2563EB', peaks: '#7C3AED', normalized: '#0F766E' }
  const [reset, setReset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragMode, setDragMode] = useState<'zoom' | 'pan'>('zoom')
  const [original, setOriginal] = useState(true)
  const [filtered, setFiltered] = useState(true)
  const [peaks, setPeaks] = useState(true)
  const [normalized, setNormalized] = useState(true)
  const container = useRef<HTMLDivElement>(null)
  const graph = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!container.current || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (graph.current?.isConnected) void Plotly.Plots.resize(graph.current)
      })
    })
    observer.observe(container.current)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [error])
  const traces: Data[] = []
  const hover = `%{x:.4f} s<br>%{y:.4f} ${signal.channel.units ?? '(unit unspecified)'}<extra>%{fullData.name}</extra>`
  if (original) traces.push({ x: signal.timestamps_seconds, y: signal.amplitudes, type: 'scatter', mode: 'lines', name: 'Original ECG', line: { color: colors.original, width: 1.4, simplify: false }, connectgaps: false, hovertemplate: hover })
  if (analysis && filtered) traces.push({ x: signal.timestamps_seconds, y: analysis.filtered_amplitudes, type: 'scatter', mode: 'lines', name: 'Filtered ECG', line: { color: colors.filtered, width: 1.7, simplify: false }, connectgaps: false, hovertemplate: hover })
  if (analysis && peaks) traces.push({ x: analysis.detected_peaks.map((p) => p.timestamp_seconds), y: analysis.detected_peaks.map((p) => p.filtered_amplitude), type: 'scatter', mode: 'markers', name: 'Detected peaks (algorithm)', marker: { color: colors.peaks, size: 10, symbol: 'diamond-open', line: { width: 2 } }, hovertemplate: hover })
  const showNormalized = Boolean(analysis?.normalized_signal && normalized)
  if (analysis?.normalized_signal && normalized) traces.push({ x: signal.timestamps_seconds, y: analysis.normalized_signal.amplitudes, yaxis: 'y2', type: 'scatter', mode: 'lines', name: 'Normalized ECG (z-score)', line: { color: colors.normalized, width: 1.4, dash: 'dot', simplify: false }, hovertemplate: '%{x:.4f} s<br>%{y:.4f} z-score (dimensionless)<extra>%{fullData.name}</extra>' })

  return (
    <>
      {analysis && <div className="ecg-visibility-controls" aria-label="Chart signal visibility">
        <label><input type="checkbox" checked={original} onChange={(e) => setOriginal(e.target.checked)} />Original ECG</label>
        <label><input type="checkbox" checked={filtered} onChange={(e) => setFiltered(e.target.checked)} />Filtered ECG</label>
        <label><input type="checkbox" checked={peaks} onChange={(e) => setPeaks(e.target.checked)} />Detected peaks (algorithm)</label>
        {analysis.normalized_signal && <label><input type="checkbox" checked={normalized} onChange={(e) => setNormalized(e.target.checked)} />Normalized ECG (z-score)</label>}
      </div>}
      <div className="ecg-chart-toolbar">
        <span>Drag to {dragMode} · hover to inspect samples</span>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="ecg-tool" aria-pressed={dragMode === 'zoom'} onClick={() => setDragMode('zoom')}><Icon name="zoom" width={16} height={16} />Zoom</button>
          <button type="button" className="ecg-tool" aria-pressed={dragMode === 'pan'} onClick={() => setDragMode('pan')}><Icon name="pan" width={16} height={16} />Pan</button>
          <button type="button" className="ecg-tool" onClick={() => { setReset((value) => value + 1); setError(null) }}><Icon name="reset" width={16} height={16} />Reset view</button>
        </div>
      </div>
      {error ? <p role="alert" className="ecg-chart-message">Chart could not be rendered: {error}</p> : (
        <div ref={container} className="ecg-plot" role="img" aria-label={`ECG waveform for record ${signal.record_id}, ${signal.channel.name}, ${signal.sample_count} samples`}>
          <Plot
            key={`${signal.record_id}-${signal.channel.index}-${signal.start_sample}-${reset}`}
            data={traces}
            layout={{
              autosize: true, height: 440, dragmode: dragMode, showlegend: Boolean(analysis),
              legend: { orientation: 'h', x: 0, y: 1.08, yanchor: 'bottom' },
              margin: { l: 65, r: showNormalized ? 75 : 25, t: 20, b: 60 },
              paper_bgcolor: colors.surface, plot_bgcolor: colors.surface,
              font: { family: 'Inter, sans-serif', color: colors.text, size: 14 },
              hoverlabel: { bgcolor: colors.surface, bordercolor: colors.grid, font: { color: colors.text, size: 14 } },
              xaxis: {
                title: { text: 'Time (s)', standoff: 18 },
                range: [signal.start_seconds, signal.start_seconds + signal.duration_seconds],
                gridcolor: colors.grid, zeroline: false, tickformat: '.2f',
              },
              yaxis: {
                title: { text: `Amplitude (${signal.channel.units ?? 'unit unspecified'})`, standoff: 15 },
                gridcolor: colors.grid, zerolinecolor: colors.zero, autorange: true,
              },
              yaxis2: { title: { text: 'Z-score (dimensionless)', standoff: 12 }, overlaying: 'y', side: 'right', showgrid: false, zeroline: false, visible: showNormalized, autorange: true },
              hovermode: 'closest', uirevision: `${signal.start_sample}-${signal.end_sample_exclusive}-${signal.channel.index}-${reset}`,
            }}
            config={{ responsive: true, displaylogo: false, scrollZoom: true, doubleClick: 'reset', modeBarButtons: [['zoom2d', 'pan2d'], ['zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d']] }}
            useResizeHandler style={{ width: '100%', height: '100%' }}
            onInitialized={(_figure, element) => { graph.current = element }}
            onPurge={(_figure, element) => { if (graph.current === element) graph.current = null }}
            onError={(reason) => { setError(reason.message); notify.error('Chart could not be rendered', reason.message, { id: 'chart-error' }) }}
          />
        </div>
      )}
    </>
  )
}
