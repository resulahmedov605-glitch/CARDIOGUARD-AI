import toast, { ToastBar, Toaster } from 'react-hot-toast'
import { Icon } from './Icon'

export function NotificationCenter() {
  return (
    <Toaster position="bottom-right" gutter={12} containerClassName="notification-center"
      containerStyle={{ bottom: 20, right: 20, left: 20 }}
      toastOptions={{ style: {
        background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)',
        borderRadius: 14, padding: 16, maxWidth: 'min(420px, calc(100vw - 40px))',
        boxShadow: '0 12px 36px rgb(0 0 0 / 16%)',
      } }}>
      {(item) => <ToastBar toast={item}>
        {({ icon, message }) => <>
          <span className="toast-symbol">{icon}</span>
          {message}
          <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => toast.dismiss(item.id)}>
            <Icon name="close" width={17} height={17} />
          </button>
        </>}
      </ToastBar>}
    </Toaster>
  )
}
