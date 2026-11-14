import { act,cleanup,fireEvent,render,screen } from '@testing-library/react'
import { afterEach,expect,test,vi } from 'vitest'
import type { Data, Layout } from 'plotly.js'
import { ThemeProvider } from '../../hooks/useTheme'
import { Header } from '../../components/Header'
import ECGChart from './ECGChart'
import {signalFixture,analysisFixture} from './analysis.test-fixtures'

const { resizePlot } = vi.hoisted(() => ({ resizePlot: vi.fn() }))
vi.mock('plotly.js',()=>({default:{ Plots: { resize: resizePlot } }}))
vi.mock('react-plotly.js/factory', async () => {
 const { useEffect, useRef } = await import('react')
 return { default: () => function MockPlot({ data, layout, onInitialized }: {
  data: Data[]; layout: Partial<Layout>; onInitialized?: (figure: unknown, element: HTMLElement) => void
 }) {
  const element = useRef<HTMLDivElement>(null)
  useEffect(() => { if (element.current) onInitialized?.({}, element.current) }, [])
  return <div ref={element} data-testid="plot-traces" data-background={layout.paper_bgcolor}>{JSON.stringify(data)}</div>
 } }
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

test('comparison traces use real timestamps and independent visibility controls',()=>{
 render(<ECGChart signal={signalFixture} analysis={analysisFixture} />)
 const traces=()=>JSON.parse(screen.getByTestId('plot-traces').textContent!)
 expect(traces().map((trace:Data)=>trace.name)).toEqual(['Original ECG','Filtered ECG','Detected peaks (algorithm)'])
 expect(traces()[1].y).toEqual(analysisFixture.filtered_amplitudes)
 expect(traces()[2].x).toEqual([.8,1.6,2.4])
 fireEvent.click(screen.getByLabelText('Original ECG'))
 expect(traces().map((trace:Data)=>trace.name)).toEqual(['Filtered ECG','Detected peaks (algorithm)'])
 fireEvent.click(screen.getByLabelText('Detected peaks (algorithm)'))
 expect(traces()).toHaveLength(1)
 fireEvent.click(screen.getByLabelText('Filtered ECG'))
 expect(traces()).toHaveLength(0)
 fireEvent.click(screen.getByLabelText('Original ECG'))
 expect(traces()[0].y).toEqual(signalFixture.amplitudes)
})

test('raw Sprint 1 rendering remains available before analysis',()=>{
 render(<ECGChart signal={signalFixture} />)
 expect(JSON.parse(screen.getByTestId('plot-traces').textContent!)).toHaveLength(1)
 expect(screen.queryByLabelText('Filtered ECG')).toBeNull()
})

test('chart palette follows theme changes without discarding trace visibility', () => {
 delete document.documentElement.dataset.theme
 localStorage.setItem('cardioguard.theme', 'light')
 const { unmount } = render(<ThemeProvider><Header section="ecg-analyzer" /><ECGChart signal={signalFixture} analysis={analysisFixture} /></ThemeProvider>)
 fireEvent.click(screen.getByLabelText('Original ECG'))
 fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
 const plot = screen.getByTestId('plot-traces')
 expect(plot.getAttribute('data-background')).toBe('#1B1820')
 const traces = JSON.parse(plot.textContent!)
 expect(traces.map((trace:Data)=>trace.name)).toEqual(['Filtered ECG','Detected peaks (algorithm)'])
 expect(traces[0].line.color).toBe('#7DB2FF')
 fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
 expect(plot.getAttribute('data-background')).toBe('#FFFFFF')
 unmount()
 localStorage.clear()
 delete document.documentElement.dataset.theme
})

test('container resizing updates Plotly and releases its observer when leaving the chart', () => {
 let onResize: () => void = () => {}
 const observe = vi.fn()
 const disconnect = vi.fn()
 vi.stubGlobal('ResizeObserver', class {
  constructor(callback: () => void) { onResize = callback }
  observe = observe
  disconnect = disconnect
 })
 const frames = new Map<number, FrameRequestCallback>()
 let nextFrame = 0
 const cancelFrame = vi.fn((id: number) => frames.delete(id))
 vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
  frames.set(++nextFrame, callback)
  return nextFrame
 })
 vi.stubGlobal('cancelAnimationFrame', cancelFrame)
 const { unmount } = render(<ECGChart signal={signalFixture} analysis={analysisFixture} />)
 expect(observe).toHaveBeenCalledWith(screen.getByRole('img'))
 fireEvent.click(screen.getByLabelText('Original ECG'))
 act(() => { onResize(); onResize() })
 expect(frames.size).toBe(1)
 act(() => {
  const queued = [...frames.values()]
  frames.clear()
  queued.forEach((callback) => callback(0))
 })
 expect(resizePlot).toHaveBeenCalledExactlyOnceWith(screen.getByTestId('plot-traces'))
 expect(JSON.parse(screen.getByTestId('plot-traces').textContent!).map((trace: Data) => trace.name))
  .toEqual(['Filtered ECG', 'Detected peaks (algorithm)'])
 act(() => onResize())
 unmount()
 expect(disconnect).toHaveBeenCalledOnce()
 expect(frames.size).toBe(0)
})
