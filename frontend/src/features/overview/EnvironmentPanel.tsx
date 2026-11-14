import { Icon } from '../../components/Icon'
import type { useHealth } from '../../hooks/useHealth'

type Props = ReturnType<typeof useHealth>

export function EnvironmentPanel({ status, checkedAt, checkHealth }: Props) {
  const label = { checking: 'Checking', online: 'Connected', offline: 'Unavailable' }[status]

  return (
    <section className="panel environment-panel" aria-labelledby="environment-title">
      <div className="flex items-center justify-between">
        <h2 id="environment-title" className="panel-title">Environment</h2>
        <Icon name="server" className="text-subtle" width="18" height="18" />
      </div>
      <p className="panel-description">A look at your local setup.</p>

      <div className="environment-row">
        <div>
          <span className="environment-row-title">Frontend</span>
          <span className="environment-row-detail">React + TypeScript</span>
        </div>
        <span className="subtle-status">
          <Icon name="success" width={15} height={15} className="text-success" />Running
        </span>
      </div>
      <div className="environment-row">
        <div>
          <span className="environment-row-title">Backend API</span>
          <span className="environment-row-detail">Python · FastAPI</span>
        </div>
        <span className={`subtle-status health-${status}`} role="status">
          <Icon name={status === 'checking' ? 'loading' : status === 'online' ? 'online' : 'offline'} width={15} height={15} className={status === 'checking' ? 'animate-spin' : undefined} />{label}
        </span>
      </div>
      <div className="endpoint-box">
        <div className="flex items-center gap-2">
          <span className="method-label">GET</span>
          <code>/api/v1/health</code>
        </div>
        <p>
          {status === 'online'
            ? 'API is responding successfully.'
            : status === 'checking'
              ? 'Checking the backend connection…'
              : 'Start the backend to connect.'}
        </p>
      </div>

      <button
        type="button"
        className="check-button"
        onClick={() => void checkHealth(true)}
        disabled={status === 'checking'}
      >
        <Icon
          name={status === 'checking' ? 'loading' : 'refresh'}
          className={status === 'checking' ? 'animate-spin' : ''}
          width="15"
          height="15"
        />
        {status === 'checking' ? 'Checking connection…' : 'Check connection'}
      </button>
      <p className="last-checked">
        {checkedAt
          ? `Last checked ${checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : 'Waiting for the first check'}
        {' · auto-checks every 30s'}
      </p>
    </section>
  )
}
