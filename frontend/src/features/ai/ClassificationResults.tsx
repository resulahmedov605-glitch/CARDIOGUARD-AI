import type { ReactNode } from 'react'
import type { ClassificationResult } from '../../lib/ai'

const percent = (value: number | null) =>
  value === null ? 'Insufficient data' : `${(value * 100).toFixed(1)}%`

export function ClassificationResults({
  data,
  children,
}: {
  data: ClassificationResult
  children?: ReactNode
}) {
  return (
    <>
      <dl className="ecg-statistics" aria-label="Classification counts">
        <div>
          <dt>Normal (N) estimates</dt>
          <dd>
            {data.counts.N} · {percent(data.proportions.N)}
          </dd>
        </div>
        <div>
          <dt>PVC (V) estimates</dt>
          <dd>
            {data.counts.V} · {percent(data.proportions.V)}
          </dd>
        </div>
        <div>
          <dt>Classified beats</dt>
          <dd>{data.beats.length}</dd>
        </div>
        <div>
          <dt>Skipped candidates</dt>
          <dd>{data.skipped_count}</dd>
        </div>
      </dl>
      {children}
      {!data.beats.length && (
        <p className="ecg-analysis-notice">No complete usable beats. Try a longer interval.</p>
      )}
      <details className="ecg-analysis-details">
        <summary>Predicted beats and probabilities</summary>
        <div className="ecg-table-scroll">
          <table>
            <caption>Model estimates for detected beats</caption>
            <thead>
              <tr>
                <th>Time (s)</th>
                <th>Sample</th>
                <th>Estimate</th>
                <th>P(N)</th>
                <th>P(PVC)</th>
              </tr>
            </thead>
            <tbody>
              {data.beats.map((beat) => (
                <tr key={beat.record_sample_index}>
                  <td>{beat.timestamp_seconds.toFixed(4)}</td>
                  <td>{beat.record_sample_index}</td>
                  <td>{beat.label === 'N' ? 'Normal (N)' : 'PVC (V)'}</td>
                  <td>{percent(beat.probabilities.N)}</td>
                  <td>{percent(beat.probabilities.V)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <div className="ecg-analysis-warnings" role="note">
        <ul>
          {data.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      </div>
    </>
  )
}
