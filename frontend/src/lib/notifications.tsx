import toast from 'react-hot-toast'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'

export type Notice = { title: string; description?: string; tone?: 'success' | 'warning' | 'info' }
type Options = { id?: string; action?: { label: string; onClick: () => void } }
type Tone = 'success' | 'error' | 'loading' | 'info' | 'warning'
const icons: Record<Tone, IconName> = { success: 'success', error: 'error', loading: 'loading', info: 'info', warning: 'warning' }

function show(tone: Tone, title: string, description?: string, options: Options = {}) {
  const handler = tone === 'success' ? toast.success : tone === 'error' ? toast.error : tone === 'loading' ? toast.loading : toast
  return handler((item) => (
    <div className="toast-copy">
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {options.action && <button className="toast-action" type="button" onClick={() => {
        toast.dismiss(item.id)
        options.action?.onClick()
      }}>{options.action.label}<Icon name="arrow" width={14} height={14} /></button>}
    </div>
  ), {
    id: options.id, className: `app-toast toast-${tone}`,
    icon: <Icon name={icons[tone]} width={22} height={22} className={tone === 'loading' ? 'animate-spin' : undefined} />,
    duration: tone === 'loading' ? Infinity : tone === 'error' ? 5000 : tone === 'warning' ? 4000 : 2800,
    ariaProps: { role: tone === 'error' ? 'alert' : 'status', 'aria-live': tone === 'error' ? 'assertive' : 'polite' },
  })
}

export const notify = {
  success: (title: string, description?: string, options?: Options) => show('success', title, description, options),
  error: (title: string, description?: string, options?: Options) => show('error', title, description, options),
  loading: (title: string, description?: string, options?: Options) => show('loading', title, description, options),
  info: (title: string, description?: string, options?: Options) => show('info', title, description, options),
  warning: (title: string, description?: string, options?: Options) => show('warning', title, description, options),
  dismiss: (id: string) => toast.dismiss(id),
}
