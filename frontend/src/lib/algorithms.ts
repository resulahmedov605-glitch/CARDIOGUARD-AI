export type Operation = {
  action: string
  value?: number
  index?: number
  key?: string
  priority?: number
  node?: string
  source?: string
  target?: string
  weight?: number
}
export interface LabRequest {
  algorithm: string
  values?: number[]
  target?: number | null
  window_size?: number
  nodes?: string[]
  edges?: { source: string; target: string; weight: number }[]
  start_node?: string | null
  directed?: boolean
  capacity?: number
  operations?: Operation[]
  compare?: boolean
}
export interface AlgorithmInfo {
  id: string
  name: string
  category: string
  visual: string
  description: string
  how: string
  input: string
  output: string
  time: string
  space: string
  advantages: string
  limitations: string
  use_case: string
  pseudocode: string[]
  operations: { action: string; fields: string[]; time: string }[]
  example: LabRequest
}
export interface LabState {
  values: number[]
  nodes: { id: string; label: string; x: number | null; depth: number | null }[]
  edges: { source: string; target: string; weight?: number | null }[]
  directed: boolean
  slots: (number | null)[]
  head: number | null
  tail: number | null
  buckets: { key: string; value: number }[][]
  priorities: number[]
}
export interface LabStep {
  line: number
  message: string
  state: LabState
  active: number[]
  completed: number[]
  range: number[] | null
  current: string | null
  visited: string[]
  frontier: string[]
  distances: Record<string, number | null>
  path_edges: { source: string; target: string }[]
  error: boolean
}
export interface LabRun {
  algorithm: string
  steps: LabStep[]
  result: Record<string, unknown>
  metrics: Record<string, number>
}
export interface LabExecution { runs: LabRun[]; step_count: number }
