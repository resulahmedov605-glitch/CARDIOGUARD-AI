import { useEffect, useState, type CSSProperties } from 'react'
import { Header } from './components/Header'
import { Icon } from './components/Icon'
import { Sidebar } from './components/Sidebar'
import { navigation, sectionFromHash } from './config/navigation'
import { ModulePlaceholder } from './features/modules/ModulePlaceholder'
import { Overview } from './features/overview/Overview'
import { ECGAnalyzer } from './features/ecg/ECGAnalyzer'
import { useHealth } from './hooks/useHealth'
import { NotificationCenter } from './components/NotificationCenter'
import { SidebarResizeHandle } from './components/SidebarResizeHandle'
import { useSidebarWidth } from './hooks/useSidebarWidth'

export default function App() {
  const [section, setSection] = useState(sectionFromHash)
  const health = useHealth()
  const sidebar = useSidebarWidth()

  useEffect(() => {
    const onHashChange = () => setSection(sectionFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    document.title = `CARDIOGUARD AI · ${navigation.find((item) => item.id === section)?.title}`
    if (section !== 'overview') document.getElementById('main-content')?.focus()
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [section])

  return (
    <div className={`app-shell${sidebar.resizing ? ' sidebar-resizing' : ''}`}
      style={{ '--sidebar-width': `${sidebar.width}px` } as CSSProperties}>
      <NotificationCenter />
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main-content')?.focus()
          document.getElementById('main-content')?.scrollIntoView()
        }}
      >
        Skip to content
      </a>
      <Sidebar section={section} collapsed={sidebar.collapsed} onToggle={sidebar.toggle} />
      <SidebarResizeHandle width={sidebar.width} collapsed={sidebar.collapsed} onPreview={sidebar.preview}
        onCommit={sidebar.commit} onCancel={sidebar.cancel} onReset={sidebar.reset} onToggle={sidebar.toggle} />
      <div className="app-content">
        <Header section={section} />
        <main id="main-content" className="main-content" tabIndex={-1}>
          {section === 'overview' ? (
            <Overview {...health} />
          ) : section === 'ecg-analyzer' ? (
            <ECGAnalyzer />
          ) : (
            <ModulePlaceholder section={section} />
          )}
        </main>
        <footer className="app-footer">
          <span className="flex items-center gap-2">
            <Icon name="book" width="14" height="14" />
            For education and research. Not for clinical or diagnostic use.
          </span>
          <span className="footer-signoff">Made for curious minds.</span>
        </footer>
      </div>
    </div>
  )
}
