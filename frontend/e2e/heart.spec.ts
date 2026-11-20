import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

async function rendered(page: Page) {
  await expect(page.getByText('Model loaded', { exact: true })).toBeVisible()
  const canvas = page.getByRole('img', { name: 'Interactive 3D human heart', exact: true })
  await expect(canvas).toBeVisible()
  await canvas.scrollIntoViewIfNeeded()
  await nextFrame(page)
  return canvas
}

async function nextFrame(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

async function changed(page: Page, canvas: Locator, previous: Buffer) {
  await nextFrame(page)
  const current = await canvas.screenshot({ animations: 'disabled' })
  expect(current.equals(previous)).toBe(false)
  return current
}

test('local model is lazy loaded and supports rotation, zoom, reset and navigation', async ({ page }, testInfo) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('/#/overview')
  await expect(page.getByRole('heading', { name: 'Workspace overview' })).toBeVisible()
  expect(requests.some((url) => url.endsWith('/heart.glb'))).toBe(false)
  await page.getByRole('link', { name: '3D Heart Explorer', exact: true }).click()
  const canvas = await rendered(page)
  expect(requests.some((url) => url.endsWith('/models/heart/heart.glb'))).toBe(true)
  const initial = await canvas.screenshot({ animations: 'disabled' })
  await page.getByRole('button', { name: 'Rotate right', exact: true }).click()
  const rotated = await changed(page, canvas, initial)
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await changed(page, canvas, rotated)
  await canvas.scrollIntoViewIfNeeded()
  const panBox = (await canvas.boundingBox())!
  await page.mouse.move(panBox.x + panBox.width * .4, panBox.y + panBox.height * .5)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(panBox.x + panBox.width * .5, panBox.y + panBox.height * .55, { steps: 8 })
  await page.mouse.up({ button: 'right' })
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await nextFrame(page)
  expect((await canvas.screenshot({ animations: 'disabled' })).equals(initial)).toBe(true)
  await canvas.focus()
  await page.keyboard.press('Home')
  await nextFrame(page)
  const focused = await canvas.screenshot({ animations: 'disabled', path: testInfo.outputPath('keyboard-default.png') })
  await page.keyboard.press('ArrowLeft')
  await changed(page, canvas, focused)
  await page.keyboard.press('Home')
  await nextFrame(page)
  expect((await canvas.screenshot({ animations: 'disabled', path: testInfo.outputPath('keyboard-reset.png') })).equals(focused)).toBe(true)
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
  await canvas.scrollIntoViewIfNeeded()
  await canvas.hover()
  const beforeWheel = await canvas.screenshot({ animations: 'disabled' })
  await page.mouse.wheel(0, -180)
  await changed(page, canvas, beforeWheel)
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('heart-explorer.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const oldCanvas = await canvas.elementHandle()
  await page.getByRole('link', { name: 'ECG Analyzer', exact: true }).click()
  await expect(page.locator('.js-plotly-plot')).toBeVisible()
  expect(await oldCanvas!.evaluate((element) => element.isConnected)).toBe(false)
  expect(await oldCanvas!.evaluate((element) =>
    (element as HTMLCanvasElement).getContext('webgl2')!.isContextLost(),
  )).toBe(true)
  await page.getByRole('link', { name: '3D Heart Explorer', exact: true }).click()
  await rendered(page)
  await page.getByRole('link', { name: 'AI Lab', exact: true }).click()
  await expect(page.getByText(/^Model version: [a-f0-9]{16}$/)).toBeVisible()
})

test('verified chamber buttons highlight geometry and direct picking selects a chamber', async ({ page }, testInfo) => {
  await page.goto('/#/heart-explorer')
  const canvas = await rendered(page)
  const original = await canvas.screenshot({ animations: 'disabled' })
  for (const name of ['Left atrium', 'Right atrium', 'Left ventricle', 'Right ventricle']) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.getByRole('region', { name: 'Selected structure' }).getByRole('heading', { name, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await changed(page, canvas, original)
  }
  await page.getByRole('button', { name: 'Show whole heart', exact: true }).click()
  await canvas.scrollIntoViewIfNeeded()
  const box = (await canvas.boundingBox())!
  for (const [x, y] of [[.5, .5], [.6, .55], [.4, .55], [.65, .45], [.45, .45]]) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y)
    if (await page.locator('.heart-structure-list button[aria-pressed="true"]').count()) break
  }
  await expect(page.locator('.heart-structure-list button[aria-pressed="true"]')).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'Selected structure' })).toContainText('Function')
  await nextFrame(page)
  await canvas.screenshot({ animations: 'disabled', path: testInfo.outputPath('heart-highlight.png') })
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('heart-dark.png'), fullPage: true, animations: 'disabled' })
})

test('missing asset, graphics context loss and retries recover the actual model', async ({ page }) => {
  await page.route('**/models/heart/heart.glb', (route) => route.fulfill({ status: 404, body: 'Missing asset' }))
  await page.goto('/#/heart-explorer')
  await expect(page.getByRole('alert')).toContainText('404')
  await page.unroute('**/models/heart/heart.glb')
  await page.getByRole('button', { name: 'Reload viewer', exact: true }).click()
  const canvas = await rendered(page)
  await canvas.evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext('webgl2')!
    context.getExtension('WEBGL_lose_context')!.loseContext()
  })
  await expect(page.getByRole('alert')).toContainText('graphics context was lost')
  await page.getByRole('button', { name: 'Reload viewer', exact: true }).click()
  await rendered(page)
})

test('unsupported WebGL retains the educational guide and working navigation', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
      apply(target, element, args) {
        if (String(args[0]).includes('webgl')) return null
        return Reflect.apply(target, element, args)
      },
    })
  })
  await page.goto('/#/heart-explorer')
  await expect(page.getByRole('alert')).toContainText('Enable WebGL')
  await page.getByRole('button', { name: 'Left ventricle', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Selected structure' })).toContainText('aortic valve')
  await page.getByText('Major vessels and valves', { exact: true }).click()
  await expect(page.getByRole('definition').filter({ hasText: 'gas exchange' })).toBeVisible()
  await page.getByRole('link', { name: 'ECG Analyzer', exact: true }).click()
  await expect(page.locator('.js-plotly-plot')).toBeVisible()
})

test('mouse and native touch gestures move the model and idle rendering stops', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    const requestFrame = window.requestAnimationFrame.bind(window)
    const counter = window as typeof window & { heartTestFrames: number }
    counter.heartTestFrames = 0
    window.requestAnimationFrame = (callback) => {
      counter.heartTestFrames += 1
      return requestFrame(callback)
    }
  })
  await page.goto('/#/heart-explorer')
  const canvas = await rendered(page)
  const initial = await canvas.screenshot({ animations: 'disabled' })
  const box = (await canvas.boundingBox())!
  if (testInfo.project.name === 'desktop') {
    await page.mouse.move(box.x + box.width * .4, box.y + box.height * .5)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * .65, box.y + box.height * .6, { steps: 12 })
    await page.mouse.up()
  } else {
    const session = await page.context().newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * .4, y: box.y + box.height * .5, id: 1 }] })
    for (let step = 1; step <= 8; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * (.4 + step * .03), y: box.y + box.height * .5, id: 1 }] })
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const beforePinch = await changed(page, canvas, initial)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
      { x: box.x + box.width * .4, y: box.y + box.height * .5, id: 1 },
      { x: box.x + box.width * .6, y: box.y + box.height * .5, id: 2 },
    ] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
      { x: box.x + box.width * .3, y: box.y + box.height * .5, id: 1 },
      { x: box.x + box.width * .7, y: box.y + box.height * .5, id: 2 },
    ] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await changed(page, canvas, beforePinch)
    await session.detach()
  }
  await changed(page, canvas, initial)
  await expect(page.locator('.heart-structure-list button[aria-pressed="true"]')).toHaveCount(0)
  const frameCount = () => page.evaluate(() => (window as typeof window & { heartTestFrames: number }).heartTestFrames)
  const idle = await frameCount()
  await page.waitForTimeout(350)
  expect(await frameCount()).toBe(idle)
})
