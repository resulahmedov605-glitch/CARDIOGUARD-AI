import type { IconName } from '../components/Icon'

export const modules = [
  {
    id: 'ecg-analyzer',
    title: 'ECG Analyzer',
    icon: 'ecg',
    color: 'coral',
    category: 'SIGNAL EXPLORATION',
    description: 'A closer look at every beat. Explore ECG signals and understand their patterns.',
    planned: ['Local signal import', 'Interactive waveform viewer', 'Signal preprocessing'],
  },
  {
    id: 'ai-lab',
    title: 'AI Lab',
    icon: 'brain',
    color: 'blue',
    category: 'MACHINE LEARNING',
    description: 'Connect the data to the decisions. Learn how heartbeat classification models work.',
    planned: ['Dataset exploration', 'Heartbeat classification', 'Model evaluation'],
  },
  {
    id: 'heart-explorer',
    title: '3D Heart Explorer',
    icon: 'heart',
    color: 'violet',
    category: 'INTERACTIVE ANATOMY',
    description: 'Put the signals in context. Discover the structures that keep the heart moving.',
    planned: ['Interactive heart anatomy', 'Anatomical structure labels', 'Guided exploration'],
  },
  {
    id: 'algorithms-lab',
    title: 'Algorithms Lab',
    icon: 'algorithm',
    color: 'teal',
    category: 'STEP-BY-STEP LEARNING',
    description: 'See the logic unfold. Explore the algorithms behind signal processing and AI.',
    planned: ['Algorithm walkthroughs', 'Processing visualizations', 'Interactive learning'],
  },
] as const satisfies readonly {
  id: string
  title: string
  icon: IconName
  color: string
  category: string
  description: string
  planned: readonly string[]
}[]

export type SectionId = 'overview' | (typeof modules)[number]['id']

export const navigation = [
  { id: 'overview', title: 'Overview', icon: 'overview' },
  ...modules,
] as const

export function sectionFromHash(): SectionId {
  const id = window.location.hash.slice(2)
  return navigation.find((section) => section.id === id)?.id ?? 'overview'
}
