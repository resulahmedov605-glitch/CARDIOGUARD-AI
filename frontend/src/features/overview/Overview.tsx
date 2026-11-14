import { Icon } from '../../components/Icon'
import { modules } from '../../config/navigation'
import type { useHealth } from '../../hooks/useHealth'
import { EnvironmentPanel } from './EnvironmentPanel'

export function Overview(health: ReturnType<typeof useHealth>) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR RESEARCH WORKSPACE</div>
          <h1>Workspace overview<Icon name="overview" className="page-title-icon" /></h1>
          <p>Explore the heart. Understand the intelligence behind it.</p>
        </div>
        <span className="sprint-badge">
          <Icon name="layers" width={16} height={16} className="text-primary" />Phase 01
          <span className="text-faint">/</span>ECG analysis
        </span>
      </div>

      <section className="intro-panel" aria-labelledby="intro-title">
        <div className="intro-content">
          <div className="intro-kicker"><span className="short-line" />BUILT FOR EXPLORATION</div>
          <h2 id="intro-title">Small signals.<br />Deeper understanding.</h2>
          <p>
            Your local space for heart signals, machine learning,
            <br className="hidden xl:block" /> anatomy, and the algorithms that connect them.
          </p>
          <a href="#research-modules" className="intro-link">
            Discover your workspace<Icon name="arrow" width="17" height="17" />
          </a>
        </div>
        <div className="signal-art" aria-hidden="true">
          <div className="signal-orbit orbit-one" />
          <div className="signal-orbit orbit-two" />
          <div className="signal-orbit orbit-three" />
          <div className="signal-heart">
            <Icon name="pulse" width="120" height="120" strokeWidth="1.1" />
          </div>
          <span className="art-node node-one" />
          <span className="art-node node-two" />
          <span className="art-node node-three" />
          <span className="art-caption">SIGNAL · STRUCTURE · INTELLIGENCE</span>
        </div>
      </section>

      <div className="workspace-grid">
        <section id="research-modules" className="research-modules" aria-labelledby="modules-title">
          <div className="section-heading">
            <h2 id="modules-title">Research modules</h2><span>04 modules</span>
          </div>
          <div className="modules-grid">
            {modules.map((module, index) => (
              <a
                href={`#/${module.id}`}
                className={`module-card accent-${module.color}`}
                key={module.id}
              >
                <div className="flex items-center justify-between">
                  <span className="module-icon">
                    <Icon name={module.icon} width="23" height="23" />
                  </span>
                  <span className="module-number">0{index + 1}</span>
                </div>
                <h3>{module.title}<Icon name="arrow" width="17" height="17" /></h3>
                <p>{module.description}</p>
                <div className="module-footer">
                  <span className="planned-badge">
                    <Icon name={module.id === 'ecg-analyzer' ? 'success' : 'clock'} width={15} height={15} className={module.id === 'ecg-analyzer' ? 'text-success' : 'text-subtle'} />
                    {module.id === 'ecg-analyzer' ? 'Available' : 'Planned'}
                  </span>
                  <span className="module-category">{module.category}</span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <div className="right-column">
          <EnvironmentPanel {...health} />
          <section className="panel foundation-panel" aria-labelledby="foundation-title">
            <div className="flex items-center justify-between">
              <span className="foundation-eyebrow">THE FIRST CHAPTER</span>
              <span className="text-[11px] text-subtle font-mono">01</span>
            </div>
            <h2 id="foundation-title">A strong foundation.</h2>
            <p>The essentials are in place.<br />The exploration comes next.</p>
            {[
              'Local application shell',
              'Versioned API structure',
              'Space to grow, module by module',
            ].map((item) => (
              <div className="foundation-item" key={item}>
                <span><Icon name="check" width="12" height="12" /></span>{item}
              </div>
            ))}
            <div className="foundation-footer">
              <Icon name="folder" width="14" height="14" />
              <span>CARDIOGUARD AI</span>
              <span className="ml-auto">v0.1.0</span>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
