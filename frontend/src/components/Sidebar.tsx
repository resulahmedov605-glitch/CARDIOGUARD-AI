import { navigation, type SectionId } from '../config/navigation'
import { Icon } from './Icon'

export function Sidebar({ section, collapsed, onToggle }: {
  section: SectionId; collapsed: boolean; onToggle: () => void
}) {
  return (
    <aside id="workspace-sidebar" className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
      <a className="brand" href="#/overview" aria-label="CARDIOGUARD AI home">
        <span className="brand-mark">
          <Icon name="ecg" width="25" height="25" />
        </span>
        <span className="brand-copy">
          <span className="brand-name">
            CARDIOGUARD<span className="brand-ai">AI</span>
          </span>
          <span className="brand-caption">HEART INTELLIGENCE</span>
        </span>
      </a>

      <div className="sidebar-heading">
        <div className="nav-label">WORKSPACE</div>
        <button type="button" className="sidebar-toggle" onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed} aria-controls="workspace-navigation">
          <Icon name={collapsed ? 'sidebarOpen' : 'sidebarClose'} width={18} height={18} />
        </button>
      </div>
      <nav id="workspace-navigation" aria-label="Main navigation" className="main-nav">
        {navigation.map((item) => (
          <a
            key={item.id}
            href={`#/${item.id}`}
            className={`nav-link ${section === item.id ? 'active' : ''}`}
            aria-current={section === item.id ? 'page' : undefined}
            title={item.title}
            aria-label={item.title}
          >
            <Icon name={item.icon} />
            <span>{item.title}</span>
            {section === item.id && <Icon name="chevron" width={14} height={14} className="nav-active-indicator" />}
          </a>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="local-note">
          <span className="local-note-icon">
            <Icon name="shield" width="18" height="18" />
          </span>
          <div>
            <p>Your workspace. Your machine.</p>
            <span>Built to run entirely on localhost.</span>
          </div>
        </div>
        <div className="sidebar-version">
          <Icon name="monitor" width={14} height={14} className="text-primary" />
          Local workspace
          <span className="ml-auto font-mono text-[10px]">v0.1.0</span>
        </div>
      </div>
    </aside>
  )
}
