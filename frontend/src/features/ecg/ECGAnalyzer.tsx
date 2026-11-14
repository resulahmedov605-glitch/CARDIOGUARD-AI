import { useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { useApiResource } from '../../hooks/useApiResource'
import type { ECGRecordMetadata, ECGRecordsResponse, ECGSignalResponse } from '../../lib/ecg'
import './ecg.css'
import { SignalAnalysis } from './SignalAnalysis'

function ErrorNotice({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="ecg-error" role="alert">
      <Icon name="error" width={24} height={24} />
      <div className="flex-1"><strong>ECG data could not be loaded</strong><p>{message}</p></div>
      <button className="ecg-tool" type="button" onClick={retry}><Icon name="refresh" width={16} height={16} />Try again</button>
    </div>
  )
}

function Loading({ children }: { children: string }) {
  return <div className="ecg-chart-message" role="status"><Icon name="loading" className="animate-spin text-primary" />{children}</div>
}

export function ECGAnalyzer() {
  const list = useApiResource<ECGRecordsResponse>('/api/v1/ecg/records')
  const [recordId, setRecordId] = useState('')
  const records = list.data?.records ?? []
  const selectedId = records.some((record) => record.record_id === recordId)
    ? recordId : records[0]?.record_id ?? ''

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SIGNAL EXPLORATION</div>
          <h1>ECG Analyzer<Icon name="ecg" className="page-title-icon" /></h1>
          <p>Explore a real recording, one interval at a time.</p>
        </div>
        <span className="sprint-badge"><Icon name="database" width={16} height={16} className="text-ecg" />MIT-BIH · Local dataset</span>
      </div>

      <section className="ecg-record-picker" aria-label="Dataset selection">
        <span className="ecg-source-icon"><Icon name="ecg" width="24" height="24" /></span>
        <div className="ecg-source"><strong>MIT-BIH Arrhythmia Database</strong><span>Original ECG signals · PhysioNet v1.0.0</span></div>
        <label className="ecg-record-select">ECG record
          <select value={selectedId} onChange={(event) => setRecordId(event.target.value)} disabled={!records.length}>
            {!records.length && <option value="">No available records</option>}
            {records.map((record) => <option key={record.record_id} value={record.record_id}>Record {record.record_id}</option>)}
          </select>
        </label>
      </section>

      {list.loading && <Loading>Finding local ECG records…</Loading>}
      {list.error && <ErrorNotice message={list.error} retry={list.retry} />}
      {list.data && !records.length && (
        <section className="ecg-empty">
          <Icon name="database" width="32" height="32" />
          <h2>No readable local ECG records</h2>
          <p>{list.data.unavailable_records[0]?.reason ?? 'Download record 100 from PhysioNet to get started.'}</p>
          <p>From <code>backend/</code>, using your virtual environment:</p>
          <code className="ecg-command">python -m scripts.download_mitbih</code>
          <button type="button" className="primary-button" onClick={list.retry}><Icon name="refresh" width={18} height={18} />Refresh records</button>
        </section>
      )}
      {selectedId && <RecordViewer key={selectedId} recordId={selectedId} />}
      <p className="ecg-attribution">
        Source: Moody &amp; Mark, MIT-BIH Arrhythmia Database (2005).
        {' '}<a href="https://physionet.org/content/mitdb/1.0.0/" target="_blank" rel="noreferrer">Dataset &amp; attribution <Icon name="external" width={13} height={13} /></a>
        <span>Educational research prototype · not a clinically validated diagnostic tool.</span>
      </p>
    </>
  )
}

function RecordViewer({ recordId }: { recordId: string }) {
  const metadata = useApiResource<ECGRecordMetadata>(`/api/v1/ecg/records/${encodeURIComponent(recordId)}`)
  const [channel, setChannel] = useState(0)
  const [start, setStart] = useState('0')
  const [duration, setDuration] = useState('10')
  const [range, setRange] = useState({ start: 0, duration: 10 })
  const [rangeError, setRangeError] = useState<string | null>(null)
  const params = new URLSearchParams({
    channel: String(channel), start_seconds: String(range.start), duration_seconds: String(range.duration),
  })
  const signal = useApiResource<ECGSignalResponse>(metadata.data
    ? `/api/v1/ecg/records/${encodeURIComponent(recordId)}/signal?${params}` : null)

  function applyInterval(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const from = Number(start), length = Number(duration)
    if (start.trim() === '' || duration.trim() === '' || !Number.isFinite(from)
      || !Number.isFinite(length) || from < 0 || length <= 0 || length > 30
      || from + length > (metadata.data?.duration_seconds ?? 0)) {
      const message = 'Choose a start of 0 or greater and a duration of up to 30 seconds, within the record.'
      setRangeError(message)
      return
    }
    setRangeError(null)
    setRange({ start: from, duration: length })
    if (from === range.start && length === range.duration) signal.retry()
  }

  if (metadata.loading) return <Loading>Reading record metadata…</Loading>
  if (metadata.error) return <ErrorNotice message={metadata.error} retry={metadata.retry} />
  if (!metadata.data) return null
  const record = metadata.data

  return (
    <>
      <form className="ecg-controls" onSubmit={applyInterval} aria-label="Signal interval controls">
        <label>Channel
          <select value={channel} onChange={(event) => setChannel(Number(event.target.value))}>
            {record.channels.map((item) => <option key={item.index} value={item.index}>{item.name}{item.units ? ` (${item.units})` : ''}</option>)}
          </select>
        </label>
        <label>Start time (s)
          <input type="number" min="0" max={record.duration_seconds} step="any" required value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label>Duration (s)
          <input type="number" min="0.001" max="30" step="any" required value={duration} onChange={(event) => setDuration(event.target.value)} />
        </label>
        <button type="submit" className="primary-button"><Icon name="arrow" width="16" height="16" />Update interval</button>
        <p className="ecg-controls-hint">Up to 30 seconds per request · load an interval, then run signal analysis below.</p>
        {rangeError && <p className="ecg-form-error" role="alert">{rangeError}</p>}
      </form>

      <section className="ecg-chart-panel" aria-labelledby="waveform-title" aria-busy={signal.loading}>
        <div className="ecg-chart-heading">
          <div><h2 id="waveform-title">ECG waveform</h2><p>Record {recordId} <span> / </span> {record.channels[channel].name}</p></div>
          {signal.data && <span className="ecg-sample-count">{signal.data.sample_count.toLocaleString()} samples <span>·</span> {signal.data.sampling_frequency_hz} Hz</span>}
        </div>
        {signal.loading && <Loading>Loading ECG samples…</Loading>}
        {signal.error && <ErrorNotice message={signal.error} retry={signal.retry} />}
        {signal.data && (
          <SignalAnalysis key={`${signal.data.channel.index}-${signal.data.start_sample}-${signal.data.end_sample_exclusive}`} signal={signal.data} />
        )}
      </section>

      <section className="ecg-info-panel" aria-labelledby="record-info-title">
        <h2 id="record-info-title"><Icon name="info" width={18} height={18} />Record information</h2>
        <dl className="ecg-info-grid">
          <div><dt>Record ID</dt><dd>{record.record_id}</dd></div>
          <div><dt>Sampling frequency</dt><dd>{record.sampling_frequency_hz} <span>Hz</span></dd></div>
          <div><dt>Channels ({record.number_of_channels})</dt><dd>{record.channels.map((item) => item.name).join(', ')}</dd></div>
          <div><dt>Total duration</dt><dd>{record.duration_seconds.toFixed(2)} <span>s</span></dd></div>
          <div><dt>Displayed interval</dt><dd>{signal.data ? `${signal.data.start_seconds.toFixed(3)} – ${(signal.data.start_seconds + signal.data.duration_seconds).toFixed(3)} s` : '—'}</dd></div>
        </dl>
      </section>
    </>
  )
}
