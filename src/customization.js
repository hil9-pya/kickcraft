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
