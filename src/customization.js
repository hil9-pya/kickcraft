export const PARTS = [
  { id: 'upper', label: 'Upper', material: 'UpperMaterial' },
  { id: 'toe-cap', label: 'Toe cap', material: 'ToeCapMaterial' },
  { id: 'tongue', label: 'Tongue', material: 'TongueMaterial' },
  { id: 'laces', label: 'Laces', material: 'LacesMaterial' },
  { id: 'heel-panel', label: 'Heel panel', material: 'HeelPanelMaterial' },
  { id: 'side-accents', label: 'Side accents', material: 'SideAccentsMaterial' },
  { id: 'midsole', label: 'Midsole', material: 'MidsoleMaterial' },
  { id: 'outsole', label: 'Outsole', material: 'OutsoleMaterial' },
]

export function setMaterialColor(model, materialName, color) {
  const material = model?.getMaterialByName(materialName)
  if (!material) return false
  material.pbrMetallicRoughness.setBaseColorFactor(color)
  return true
}

export const CHARMS = [
  { id: 'none', label: 'None', src: null },
  { id: 'star', label: 'Star', src: '/models/charms/star-charm.glb' },
  { id: 'lightning', label: 'Lightning', src: '/models/charms/lightning-charm.glb' },
  { id: 'k-tag', label: 'K tag', src: '/models/charms/k-tag-charm.glb' },
]

export function charmScale(charmId, selectedCharmId) {
  return charmId === selectedCharmId ? '1 1 1' : '0 0 0'
}
