import { lazy, Suspense, useState } from 'react'
import type { FormEvent } from 'react'
import type { ECGSignalResponse } from '../../lib/ecg'
import type { AnalysisRequest, ECGAnalysis } from '../../lib/analysis'
import { useApiResource } from '../../hooks/useApiResource'
import { Icon } from '../../components/Icon'

const ECGChart = lazy(() => import('./ECGChart'))
const numberOrMissing = (value: number | null | undefined, digits = 2) => value == null ? 'Insufficient data' : value.toFixed(digits)
const percentageOrMissing = (value: number | null) => value == null ? 'Insufficient data' : `${(value * 100).toFixed(1)}%`

export function SignalAnalysis({ signal }: { signal: ECGSignalResponse }) {
  const [highpass, setHighpass] = useState('0.5')
  const [lowpass, setLowpass] = useState('40')
  const [baseline, setBaseline] = useState(true)
  const [noise, setNoise] = useState(true)
  const [order, setOrder] = useState('3')
  const [normalization, setNormalization] = useState<'none' | 'zscore'>('none')
  const [refractory, setRefractory] = useState('0.25')
  const [threshold, setThreshold] = useState('0.35')
  const [body, setBody] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const result = useApiResource<ECGAnalysis>(body ? '/api/v1/ecg/analyze' : null, body, {
    id: 'ecg-analysis', error: 'Analysis could not be completed',
    success: (data) => data.statistics.valid_interval_count > 0
      ? { title: 'Analysis complete', description: `${data.statistics.peak_count} algorithm-generated peaks; ${data.statistics.valid_interval_count} RR intervals.` }
      : { title: 'Analysis complete — insufficient peaks', description: 'Choose a longer interval to estimate RR and heart rate.', tone: 'warning' },
  })
  const data = result.data

  function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const high = baseline ? Number(highpass) : null, low = noise ? Number(lowpass) : null
    if ((baseline && (!highpass.trim() || high! < .05 || high! > 10 || !Number.isFinite(high)))
      || (noise && (!lowpass.trim() || low! < 10 || low! > 150 || !Number.isFinite(low)))
      || (high !== null && low !== null && high >= low)
      || (low !== null && low >= signal.sampling_frequency_hz / 2)) {
      const message = 'Choose valid cutoffs: high-pass 0.05–10 Hz, low-pass 10–150 Hz below Nyquist, with high-pass below low-pass.'
      setError(message)
      return
    }
    const request: AnalysisRequest = {
      record_id: signal.record_id, channel: signal.channel.index,
      start_seconds: signal.requested_start_seconds, duration_seconds: signal.requested_duration_seconds,
      preprocessing: { highpass_hz: high, lowpass_hz: low, order: Number(order), normalization },
      detection: { refractory_seconds: Number(refractory), threshold_scale: Number(threshold) },
    }
    const next = JSON.stringify(request)
    setError(null)
    setBody(next)
    if (next === body) result.retry()
  }

  return (
    <>
      <form className="ecg-analysis-controls" aria-label="ECG analysis controls" onSubmit={run}>
        <div className="ecg-analysis-title"><Icon name="settings" width={20} height={20} /><strong>Signal processing</strong><span>Run on the displayed channel and interval</span></div>
        <div className="ecg-processing-grid ecg-main-processing">
          <div className="ecg-filter-field"><label><input type="checkbox" checked={baseline} onChange={(e) => setBaseline(e.target.checked)} /> Baseline reduction</label>
            <label>High-pass (Hz)<input type="number" step="any" min="0.05" max="10" required disabled={!baseline} value={highpass} onChange={(e) => setHighpass(e.target.value)} /></label></div>
          <div className="ecg-filter-field"><label><input type="checkbox" checked={noise} onChange={(e) => setNoise(e.target.checked)} /> Noise reduction</label>
            <label>Low-pass (Hz)<input type="number" step="any" min="10" max="150" required disabled={!noise} value={lowpass} onChange={(e) => setLowpass(e.target.value)} /></label></div>
          <label>Filter order<select value={order} onChange={(e) => setOrder(e.target.value)}>{[1, 2, 3, 4, 5, 6].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Normalization<select value={normalization} onChange={(e) => setNormalization(e.target.value as 'none' | 'zscore')}><option value="none">Off</option><option value="zscore">Z-score</option></select></label>
          <button type="submit" className="primary-button" disabled={result.loading}><Icon name={result.loading ? 'loading' : 'play'} width={18} height={18} className={result.loading ? 'animate-spin' : undefined} />{result.loading ? 'Analyzing…' : 'Run analysis'}</button>
        </div>
        <details className="ecg-detection-settings"><summary>Peak detection settings</summary><div className="ecg-processing-grid">
          <label>Minimum peak spacing (s)<input type="number" required min="0.2" max="1" step="any" value={refractory} onChange={(e) => setRefractory(e.target.value)} /></label>
          <label>Detection threshold scale<input type="number" required min="0.05" max="2" step="any" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></label>
        </div></details>
        <p className="ecg-controls-hint">Original samples are preserved. Parameters apply when you run analysis. Use at least 0.5 seconds.</p>
        {error && <p role="alert" className="ecg-form-error">{error}</p>}
      </form>
      {result.loading && <p className="ecg-analysis-notice" role="status">Filtering ECG and detecting peaks…</p>}
      {result.error && <div className="ecg-error" role="alert"><Icon name="error" /><p className="flex-1">{result.error}</p><button type="button" className="ecg-tool" onClick={result.retry}><Icon name="refresh" width={16} height={16} />Retry analysis</button></div>}
      <Suspense fallback={<p className="ecg-chart-message" role="status">Preparing interactive waveform…</p>}>
        <ECGChart signal={data?.original_signal ?? signal} analysis={data ?? undefined} />
      </Suspense>
      {data && <>
        <p className="ecg-analysis-notice">Applied: high-pass {data.parameters.preprocessing.highpass_hz ?? 'off'} Hz · low-pass {data.parameters.preprocessing.lowpass_hz ?? 'off'} Hz · order {data.parameters.preprocessing.order}. Peaks are algorithm-generated QRS candidates.</p>
        {data.normalized_signal && <p className="ecg-analysis-notice">Z-score normalization uses the filtered interval's mean and population standard deviation. Its right-hand axis is dimensionless; original and filtered ECG retain {signal.channel.units ?? 'their original units'}. Peak detection and BPM use the filtered ECG.</p>}
        <dl className="ecg-statistics" aria-label="Estimated heartbeat statistics">
          <div><dt><Icon name="pulse" width={17} height={17} />Estimated average BPM</dt><dd>{numberOrMissing(data.statistics.average_bpm, 1)}</dd></div>
          <div><dt><Icon name="ecg" width={17} height={17} />Detected peaks</dt><dd>{data.statistics.peak_count}</dd></div>
          <div><dt><Icon name="timer" width={17} height={17} />Average RR (s)</dt><dd>{numberOrMissing(data.statistics.mean_rr_seconds, 3)}</dd></div>
          <div><dt><Icon name="list" width={17} height={17} />Valid RR intervals</dt><dd>{data.statistics.valid_interval_count}</dd></div>
        </dl>
        <details className="ecg-analysis-details"><summary>RR intervals and peak timestamps</summary>
          <p>Minimum RR: {numberOrMissing(data.statistics.min_rr_seconds, 3)} s · maximum RR: {numberOrMissing(data.statistics.max_rr_seconds, 3)} s · population SD: {numberOrMissing(data.statistics.std_rr_seconds, 3)} s</p>
          <div className="ecg-table-scroll"><table><caption>Algorithm-generated peaks and successive RR intervals</caption><thead><tr><th>Peak time (s)</th><th>Record sample</th><th>RR (ms)</th><th>Estimated BPM</th></tr></thead>
            <tbody>{data.detected_peaks.map((peak, i) => <tr key={peak.record_sample_index}><td>{peak.timestamp_seconds.toFixed(4)}</td><td>{peak.record_sample_index}</td><td>{numberOrMissing(data.statistics.rr_milliseconds[i - 1], 1)}</td><td>{numberOrMissing(data.statistics.instantaneous_bpm[i - 1], 1)}</td></tr>)}</tbody></table></div>
        </details>
        {data.reference_comparison && <details className="ecg-analysis-details"><summary>Reference annotation comparison</summary>
          <p>Official MIT-BIH reference beats, separate from detected peaks. Tolerance: ±{data.reference_comparison.tolerance_seconds} s.</p>
          <p>Matched: {data.reference_comparison.true_positives} / {data.reference_comparison.reference_count} · extra detections: {data.reference_comparison.false_positives} · missed references: {data.reference_comparison.false_negatives}</p>
          <p>Selected-interval sensitivity: {percentageOrMissing(data.reference_comparison.sensitivity)} · positive predictivity: {percentageOrMissing(data.reference_comparison.positive_predictivity)}. This is not clinical accuracy.</p>
        </details>}
        <div className="ecg-analysis-warnings" role="note"><strong><Icon name="info" width={18} height={18} />Analysis limitations</strong><ul>{data.warnings.map((warning) => <li key={warning}><Icon name="info" width={15} height={15} /><span>{warning}</span></li>)}</ul></div>
      </>}
    </>
  )
}
