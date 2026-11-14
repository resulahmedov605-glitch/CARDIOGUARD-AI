import { Icon } from '../../components/Icon'
import { modules, type SectionId } from '../../config/navigation'

export function ModulePlaceholder({ section }: { section: Exclude<SectionId, 'overview'> }) {
  const module = modules.find((item) => item.id === section)!

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{module.category}</div>
          <h1>{module.title}<Icon name={module.icon} className="page-title-icon" /></h1>
          <p>{module.description}</p>
        </div>
        <span className="sprint-badge"><Icon name="clock" width={16} height={16} />Planned module</span>
      </div>
      <section
        className={`placeholder-panel accent-${module.color}`}
        aria-labelledby="placeholder-title"
      >
        <span className="placeholder-icon module-icon">
          <Icon name={module.icon} width="34" height="34" />
        </span>
        <span className="eyebrow mt-7">A SPACE FOR WHAT COMES NEXT</span>
        <h2 id="placeholder-title">The foundation is here.<br />This lab is next.</h2>
        <p>
          This module is reserved for a future sprint. Today, we're building
          <br className="hidden sm:block" /> the workspace that will make exploration possible.
        </p>
        <div className="planned-features">
          {module.planned.map((feature) => <span key={feature}>{feature}</span>)}
        </div>
        <a className="primary-button" href="#/overview">
          <Icon name="overview" width="16" height="16" />Back to overview
        </a>
        <span className="placeholder-note">Planned capabilities · not available in Sprint 1</span>
      </section>
    </>
  )
}
