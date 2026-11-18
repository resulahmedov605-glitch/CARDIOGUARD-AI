import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, vi } from 'vitest'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three'
import { structures, identifyStructure } from './anatomy'
import { disposeModel } from './heart-scene'

test('both local assets preserve the source mappings for all selectable structures', () => {
  const folder = resolve('public/models/heart')
  const nodes: { name: string; mesh: number; extras: { ontologyid: string; source_spatial_entity: string } }[] = []
  for (const name of ['heart.glb', 'cardiac-vessels.glb']) {
    const asset = readFileSync(`${folder}/${name}`)
    expect(asset.toString('utf8', 0, 4)).toBe('glTF')
    expect(asset.readUInt32LE(8)).toBe(asset.length)
    const model = JSON.parse(asset.toString('utf8', 20, 20 + asset.readUInt32LE(12)))
    nodes.push(...model.nodes.filter((node: { mesh?: number }) => node.mesh !== undefined))
    const sourceName = name === 'heart.glb' ? 'source.json' : 'vessels-source.json'
    const source = JSON.parse(readFileSync(`${folder}/${sourceName}`, 'utf8'))
    expect(createHash('sha256').update(asset).digest('hex')).toBe(source.sha256[name])
    expect(source.license).toBe('CC BY 4.0')
  }
  const crosswalk = readFileSync(`${folder}/crosswalk.csv`, 'utf8') + readFileSync(`${folder}/vessels-crosswalk.csv`, 'utf8')
  expect(structures).toHaveLength(18)
  expect(nodes).toHaveLength(42)
  for (const structure of structures) {
    for (const mapping of structure.meshes) {
      const node = nodes.find((node) => node.name === mapping.node)!
      expect(node.mesh).toBeTypeOf('number')
      expect(identifyStructure(node.name, node.extras.ontologyid)).toBe(structure.id)
      expect(node.extras.source_spatial_entity).toBe('#VHFemaleOrgans')
      expect(crosswalk).toContain(`${mapping.node},${mapping.ontology},`)
      expect(identifyStructure(node.name, 'incorrect-ontology')).toBeNull()
    }
  }
  expect(nodes.some((node) => node.name === 'VH_F_left_anterior_descending_artery')).toBe(false)
  expect(identifyStructure('unknown-vessel', 'UBERON:0000947')).toBeNull()
})

test('scene cleanup releases shared materials, textures and geometry and detaches the model', () => {
  const scene = new Group()
  const model = new Group()
  const geometry = new BoxGeometry()
  const texture = new Texture()
  const material = new MeshStandardMaterial({ map: texture })
  model.add(new Mesh(geometry, material))
  model.add(new Mesh(geometry, material))
  scene.add(model)
  const geometryDisposal = vi.spyOn(geometry, 'dispose')
  const materialDisposal = vi.spyOn(material, 'dispose')
  const textureDisposal = vi.spyOn(texture, 'dispose')
  disposeModel(model)
  expect(model.parent).toBeNull()
  expect(geometryDisposal).toHaveBeenCalledOnce()
  expect(materialDisposal).toHaveBeenCalledOnce()
  expect(textureDisposal).toHaveBeenCalledOnce()
})
