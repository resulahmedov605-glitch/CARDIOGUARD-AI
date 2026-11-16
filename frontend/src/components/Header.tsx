import { navigation, type SectionId } from '../config/navigation'
import { Icon } from './Icon'
import { useTheme } from '../hooks/useTheme'

export function Header({ section }: { section: SectionId }) {
  const title = navigation.find((item) => item.id === section)?.title ?? 'Overview'
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>Workspace</span>
        <Icon name="chevron" width="12" height="12" />
        <span className="text-ink font-medium">{title}</span>
      </div>
      <div className="header-actions">
        <span className="environment-pill">
          <Icon name="monitor" width={15} height={15} className="text-primary" />
          Local environment
        </span>
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} width="19" height="19" />
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <span className="header-divider" />
        <span className="workspace-avatar" title="Local research workspace">
          <Icon name="code" width="17" height="17" />
        </span>
      </div>
    </header>
  )
}
