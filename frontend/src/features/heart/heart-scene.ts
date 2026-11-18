import {
  ACESFilmicToneMapping, Box3, BufferGeometry, Color, DirectionalLight, DoubleSide,
  Group, HemisphereLight, Material, MathUtils, Mesh, MeshStandardMaterial, Object3D,
  PerspectiveCamera, Raycaster, Scene, Sphere, Spherical, Texture,
  Vector2, Vector3, WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { defaultLayers, identifyStructure, structures } from './anatomy'
import type { AnatomyLayers, LayerId, StructureId } from './anatomy'

export const HEART_MODEL_URL = '/models/heart/heart.glb'
export const VESSELS_MODEL_URL = '/models/heart/cardiac-vessels.glb'
export type AnatomyHover = { id: StructureId; x: number; y: number }

export function disposeModel(root: Object3D) {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    geometries.add(object.geometry)
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
    meshMaterials.forEach((material) => materials.add(material))
  })
  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value instanceof Texture) textures.add(value)
    })
    material.dispose()
  })
  textures.forEach((texture) => {
    const image: unknown = texture.source.data
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close()
    texture.dispose()
  })
  root.removeFromParent()
}

export function createHeartScene(
  container: HTMLElement,
  onSelect: (id: StructureId | null) => void,
  onReady: () => void,
  onError: (message: string) => void,
  onHover: (hover: AnatomyHover | null) => void,
) {
  // Creating the renderer throws when WebGL is unavailable; the UI handles it.
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  const canvas = renderer.domElement
  canvas.tabIndex = 0
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', 'Interactive 3D human heart')
  canvas.setAttribute('aria-describedby', 'heart-controls-help')
  container.appendChild(canvas)

  const scene = new Scene()
  const camera = new PerspectiveCamera(38, 1, .01, 100)
  const controls = new OrbitControls(camera, canvas)
  // Interaction renders on demand. No idle animation or inertial motion.
  controls.enableDamping = false
  controls.rotateSpeed = .7
  controls.zoomSpeed = .8
  controls.panSpeed = .7
  controls.minPolarAngle = .05
  controls.maxPolarAngle = Math.PI - .05
  scene.add(new HemisphereLight(0xffffff, 0x7b5360, 2.2))
  const key = new DirectionalLight(0xffeee5, 2.8)
  key.position.set(3, 4, 5)
  const fill = new DirectionalLight(0xe8eaff, 1.3)
  fill.position.set(-4, 1, -3)
  scene.add(key, fill)

  let disposed = false
  let failed = false
  let ready = false
  let frame = 0
  let hoverFrame = 0
  let model: Group | null = new Group()
  let selected: StructureId | null = null
  let hovered: StructureId | null = null
  let layers: AnatomyLayers = { ...defaultLayers }
  let radius = 1.6
  const modelSize = new Vector3(2.4, 2, 1.8)
  const surfaces: {
    mesh: Mesh; material: MeshStandardMaterial; color: Color;
    id: StructureId; layer: LayerId;
  }[] = []
  const raycaster = new Raycaster()
  const request = new AbortController()
  const timeout = window.setTimeout(() => request.abort(), 15_000)

  function invalidate() {
    if (disposed || failed || frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (!disposed && !failed) renderer.render(scene, camera)
    })
  }

  function resize() {
    const { width, height } = container.getBoundingClientRect()
    if (!width || !height || disposed) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    clearHover()
    invalidate()
  }

  function applyAppearance() {
    surfaces.forEach((surface) => {
      const active = selected !== null && surface.id === selected
      const hover = hovered === surface.id
      surface.mesh.visible = layers[surface.layer]
      surface.material.color.copy(active ? new Color('#fda4af') : surface.color)
      surface.material.emissive.set(active || hover ? '#8f3148' : '#000000')
      surface.material.emissiveIntensity = active ? .2 : hover ? .3 : 0
      surface.material.opacity = selected && !active ? .14 : 1
      const transparent = surface.material.opacity < 1
      if (surface.material.transparent !== transparent) {
        surface.material.transparent = transparent
        surface.material.needsUpdate = true
      }
      surface.material.depthWrite = !transparent
    })
    invalidate()
  }

  function clearHover() {
    cancelAnimationFrame(hoverFrame)
    hoverFrame = 0
    if (hovered !== null) {
      hovered = null
      applyAppearance()
    }
    canvas.style.cursor = 'grab'
    if (!disposed) onHover(null)
  }

  function select(id: StructureId | null) {
    selected = id
    clearHover()
    applyAppearance()
  }

  function setLayers(next: AnatomyLayers) {
    layers = { ...next }
    clearHover()
    applyAppearance()
  }

  function reset(clearSelection = true) {
    const vertical = MathUtils.degToRad(camera.fov)
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect)
    const distance = (Math.max(
      modelSize.y / (2 * Math.tan(vertical / 2)),
      modelSize.x / (2 * Math.tan(horizontal / 2)),
    ) + modelSize.z / 2) * 1.15
    controls.target.set(0, 0, 0)
    camera.position.set(.12, .08, 1).normalize().multiplyScalar(distance)
    controls.minDistance = radius * .85
    controls.maxDistance = distance * 3
    controls.update()
    select(null)
    if (clearSelection) onSelect(null)
  }

  function rotate(horizontal: number, vertical = 0) {
    const offset = camera.position.clone().sub(controls.target)
    const spherical = new Spherical().setFromVector3(offset)
    spherical.theta += horizontal
    spherical.phi = MathUtils.clamp(spherical.phi + vertical, .05, Math.PI - .05)
    camera.position.copy(new Vector3().setFromSpherical(spherical).add(controls.target))
    controls.update()
  }

  function zoom(factor: number) {
    const offset = camera.position.clone().sub(controls.target)
    offset.setLength(MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance))
    camera.position.copy(controls.target).add(offset)
    controls.update()
  }

  function keydown(event: KeyboardEvent) {
    if (!ready || failed || event.ctrlKey || event.metaKey || event.altKey) return
    switch (event.key) {
      case 'ArrowLeft': rotate(-.15); break
      case 'ArrowRight': rotate(.15); break
      case 'ArrowUp': rotate(0, -.15); break
      case 'ArrowDown': rotate(0, .15); break
      case '+': case '=': zoom(.85); break
      case '-': zoom(1.18); break
      case 'Home': reset(); break
      default: return
    }
    event.preventDefault()
  }

  let pointer: { id: number; x: number; y: number } | null = null
  let dragging = false
  function pointerdown(event: PointerEvent) {
    dragging = true
    clearHover()
    canvas.style.cursor = 'grabbing'
    pointer = event.isPrimary && event.button === 0
      ? { id: event.pointerId, x: event.clientX, y: event.clientY }
      : null
  }
  function pointerup(event: PointerEvent) {
    const start = pointer
    pointer = null
    dragging = false
    canvas.style.cursor = 'grab'
    if (!ready || failed || !start || start.id !== event.pointerId ||
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return
    const surface = pick(event.clientX, event.clientY)
    const id = surface?.id ?? null
    select(id)
    onSelect(id)
  }

  function pick(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect()
    raycaster.setFromCamera(new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    ), camera)
    const visible = surfaces.filter((surface) => surface.mesh.visible)
    const hits = raycaster.intersectObjects(visible.map((surface) => surface.mesh), false)
    // Ghosted context must not obstruct the solid structure being inspected.
    const hit = hits.find((entry) => (entry.object as Mesh).material instanceof MeshStandardMaterial &&
      ((entry.object as Mesh).material as MeshStandardMaterial).opacity > .5) ?? hits[0]
    return visible.find((surface) => surface.mesh === hit?.object)
  }

  function pointermove(event: PointerEvent) {
    if (!ready || failed || dragging || event.pointerType === 'touch') return
    cancelAnimationFrame(hoverFrame)
    const { clientX, clientY } = event
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0
      if (disposed || failed || dragging) return
      const surface = pick(clientX, clientY)
      const next = surface?.id ?? null
      if (next !== hovered) {
        hovered = next
        applyAppearance()
      }
      canvas.style.cursor = next ? 'pointer' : 'grab'
      const rect = canvas.getBoundingClientRect()
      onHover(next ? { id: next, x: clientX - rect.left, y: clientY - rect.top } : null)
    })
  }

  function pointercancel() {
    pointer = null
    dragging = false
    clearHover()
  }

  function viewChanged() {
    clearHover()
    invalidate()
  }

  function contextlost(event: Event) {
    event.preventDefault()
    failed = true
    cancelAnimationFrame(frame)
    frame = 0
    controls.enabled = false
    clearHover()
    onError('The 3D graphics context was lost. Reload the viewer to restore it.')
  }

  controls.addEventListener('change', viewChanged)
  canvas.addEventListener('keydown', keydown)
  canvas.addEventListener('pointerdown', pointerdown)
  canvas.addEventListener('pointerup', pointerup)
  canvas.addEventListener('pointermove', pointermove)
  canvas.addEventListener('pointerleave', clearHover)
  canvas.addEventListener('pointercancel', pointercancel)
  canvas.addEventListener('webglcontextlost', contextlost)
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  async function loadAsset(url: string) {
    const response = await fetch(url, { signal: request.signal })
      if (!response.ok) throw new Error(`Model request failed (${response.status}).`)
    const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '')
    if (disposed || failed || !model) disposeModel(gltf.scene)
    else model.add(gltf.scene)
  }

  void Promise.all([loadAsset(HEART_MODEL_URL), loadAsset(VESSELS_MODEL_URL)])
    .then(() => {
      if (disposed || failed) {
        return
      }
      if (!model) return
      const originals = new Set<Material>()
      model.traverse((object) => {
        if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return
        originals.add(object.material)
        object.material = object.material.clone()
        object.material.side = DoubleSide
        object.material.roughness = .45
        const id = identifyStructure(object.name, object.userData.ontologyid)
        const structure = structures.find((entry) => entry.id === id)
        if (!structure) return
        object.material.color.set(structure.color)
        surfaces.push({ mesh: object, material: object.material, color: object.material.color.clone(),
          id: structure.id, layer: structure.layer })
      })
      originals.forEach((material) => material.dispose())
      const mapped = new Set(surfaces.map((surface) => surface.id))
      if (!structures.every((structure) => mapped.has(structure.id))) {
        throw new Error('The local model does not match its verified anatomy mapping.')
      }
      const bounds = new Box3().setFromObject(model)
      const scale = 2.4 / Math.max(...bounds.getSize(new Vector3()).toArray())
      if (!Number.isFinite(scale) || scale <= 0) throw new Error('The local model has invalid geometry.')
      model.position.copy(bounds.getCenter(new Vector3())).multiplyScalar(-scale)
      model.scale.setScalar(scale)
      const normalizedBounds = new Box3().setFromObject(model)
      normalizedBounds.getSize(modelSize)
      radius = normalizedBounds.getBoundingSphere(new Sphere()).radius
      scene.add(model)
      ready = true
      reset(false)
      onReady()
    })
    .catch((error: unknown) => {
      if (disposed) return
      const message = request.signal.aborted
        ? 'Loading the local heart model timed out. Try loading it again.'
        : error instanceof Error ? error.message : 'The local heart model could not be loaded.'
      failed = true
      ready = false
      request.abort()
      clearHover()
      if (model) disposeModel(model)
      model = null
      surfaces.length = 0
      onError(message)
    })
    .finally(() => window.clearTimeout(timeout))

  return {
    rotate, zoom, reset, select, setLayers,
    dispose() {
      disposed = true
      request.abort()
      window.clearTimeout(timeout)
      cancelAnimationFrame(frame)
      clearHover()
      observer.disconnect()
      controls.removeEventListener('change', viewChanged)
      controls.dispose()
      canvas.removeEventListener('keydown', keydown)
      canvas.removeEventListener('pointerdown', pointerdown)
      canvas.removeEventListener('pointerup', pointerup)
      canvas.removeEventListener('pointermove', pointermove)
      canvas.removeEventListener('pointerleave', clearHover)
      canvas.removeEventListener('pointercancel', pointercancel)
      canvas.removeEventListener('webglcontextlost', contextlost)
      if (model) disposeModel(model)
      surfaces.length = 0
      scene.clear()
      renderer.dispose()
      if (!renderer.getContext().isContextLost()) renderer.forceContextLoss()
      canvas.remove()
    },
  }
}

export type HeartScene = ReturnType<typeof createHeartScene>
