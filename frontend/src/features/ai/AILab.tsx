import { lazy, Suspense, useState } from 'react'
import type { FormEvent } from 'react'
import { ClassificationResults } from './ClassificationResults'
import { Icon } from '../../components/Icon'
import { useApiResource } from '../../hooks/useApiResource'
import type { ModelStatus, PredictionResult } from '../../lib/ai'
import type { ECGRecordMetadata, ECGRecordsResponse } from '../../lib/ecg'
import '../ecg/ecg.css'

const ECGChart = lazy(() => import('../ecg/ECGChart'))
const percent = (value: number | null) =>
  value === null ? 'Insufficient data' : `${(value * 100).toFixed(1)}%`

export function AILab() {
  const model = useApiResource<ModelStatus>('/api/v1/ai/model')
  const records = useApiResource<ECGRecordsResponse>('/api/v1/ecg/records')
  const [recordId, setRecordId] = useState('')
  const available = records.data?.records ?? []
  const record = available.find((item) => item.record_id === recordId) ?? available[0]

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MACHINE LEARNING</div>
          <h1>
            AI Lab
            <Icon name="brain" className="page-title-icon" />
          </h1>
          <p>Explore model estimates for Normal and PVC beats.</p>
        </div>
        <span className="sprint-badge">Local model · N / PVC</span>
      </div>
      <section className="ecg-info-panel mb-5" aria-label="Model information">
        <h2>Heartbeat classifier</h2>
        {model.loading && <p role="status">Checking local model…</p>}
        {model.error && (
          <div role="alert">
            <p>{model.error}</p>
            <button className="ecg-tool" onClick={model.retry}>
              Retry model check
            </button>
          </div>
        )}
        {model.data && (
          <>
            <p>
              {model.data.available ? `Model version: ${model.data.version}` : model.data.message}
            </p>
            {!model.data.available && (
              <>
                <p>From backend/, prepare real data and train once:</p>
                <code>
                  python -m scripts.download_mitbih --ml
                  <br />
                  python -m scripts.train_model
                </code>
                <p>
                  <button className="ecg-tool" onClick={model.retry}>
                    Refresh model
                  </button>
                </p>
              </>
            )}
            {model.data.evaluation && (
              <details className="ecg-analysis-details">
                <summary>Held-out evaluation</summary>
                <p>
                  Annotated beats from held-out records:{' '}
                  {model.data.splits?.test.join(', ') ?? 'see model metadata'}. Accuracy:{' '}
                  {percent(model.data.evaluation.test.accuracy)} · PVC recall:{' '}
                  {percent(model.data.evaluation.test.per_class.V.recall)}.
                </p>
                <p>
                  These figures exclude detection errors and unsupported classes. They are not
                  clinical accuracy.
                </p>
              </details>
            )}
          </>
        )}
        <p className="ecg-controls-hint">
          Educational/research estimates only. This two-class model can assign unsupported rhythms
          to N or PVC. Not a clinical diagnosis.
        </p>
      </section>
      {records.loading && <p role="status">Loading ECG records…</p>}
      {records.error && (
        <div className="ecg-error" role="alert">
          <p>{records.error}</p>
          <button className="ecg-tool" onClick={records.retry}>
            Retry records
          </button>
        </div>
      )}
      {records.data && !record && (
        <p className="ecg-empty">
          No readable ECG records. Download the local MIT-BIH dataset first.
        </p>
      )}
      {record && (
        <>
          <section className="ecg-record-picker">
            <div className="ecg-source">
              <strong>MIT-BIH Arrhythmia Database</strong>
              <span>MLII · 360 Hz · real local ECG</span>
            </div>
            <label className="ecg-record-select">
              ECG record
              <select
                value={record.record_id}
                onChange={(event) => setRecordId(event.target.value)}
              >
                {available.map((item) => (
                  <option key={item.record_id} value={item.record_id}>
                    Record {item.record_id}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <PredictionViewer
            key={record.record_id}
            record={record}
            ready={Boolean(model.data?.available)}
          />
        </>
      )}
    </>
  )
}

function PredictionViewer({ record, ready }: { record: ECGRecordMetadata; ready: boolean }) {
  const [start, setStart] = useState('0')
  const [duration, setDuration] = useState('10')
  const [body, setBody] = useState<string>()
  const [error, setError] = useState<string | null>(null)
  const result = useApiResource<PredictionResult>(body ? '/api/v1/ai/predict' : null, body)
  const channel = record.channels.find((item) => item.name === 'MLII')
  function run(event: FormEvent) {
    event.preventDefault()
    const from = Number(start),
      length = Number(duration)
    if (
      !start.trim() ||
      !duration.trim() ||
      !Number.isFinite(from) ||
      !Number.isFinite(length) ||
      from < 0 ||
      length < 0.5 ||
      length > 30 ||
      from + length > record.duration_seconds ||
      !channel
    ) {
      setError('Choose a valid interval of 0.5–30 seconds within an MLII record.')
      return
    }
    const next = JSON.stringify({
      record_id: record.record_id,
      channel: channel.index,
      start_seconds: from,
      duration_seconds: length,
    })
    setError(null)
    setBody(next)
    if (body === next) result.retry()
  }
  const data = result.data
  return (
    <>
      <form className="ecg-controls" aria-label="AI interval controls" onSubmit={run}>
        <label>
          Lead
          <select disabled>
            <option>MLII</option>
          </select>
        </label>
        <label>
          Start time (s)
          <input
            type="number"
            step="any"
            min="0"
            required
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label>
          Duration (s)
          <input
            type="number"
            step="any"
            min="0.5"
            max="30"
            required
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </label>
        <button className="primary-button" disabled={!ready || !channel || result.loading}>
          <Icon name={result.loading ? 'loading' : 'brain'} />
          {result.loading ? 'Classifying…' : 'Classify beats'}
        </button>
        <p className="ecg-controls-hint">
          Fixed model preprocessing: 0.5–40 Hz, per-beat z-score. Only complete detected beats are
          classified.
        </p>
        {error && (
          <p className="ecg-form-error" role="alert">
            {error}
          </p>
        )}
      </form>
      {result.loading && <p role="status">Detecting and classifying real ECG beats…</p>}
      {result.error && (
        <div className="ecg-error" role="alert">
          <p>{result.error}</p>
          <button className="ecg-tool" onClick={result.retry}>
            Retry classification
          </button>
        </div>
      )}
      {data && (
        <section className="ecg-chart-panel" aria-label="AI classification results">
          <div className="ecg-chart-heading">
            <h2>Beat estimates · Record {data.original_signal.record_id}</h2>
            <span>Model {data.model_version}</span>
          </div>
          <ClassificationResults data={data}>
            <Suspense fallback={<p role="status">Preparing waveform…</p>}>
              <ECGChart signal={data.original_signal} predictions={data} />
            </Suspense>
          </ClassificationResults>
        </section>
      )}
    </>
  )
}
