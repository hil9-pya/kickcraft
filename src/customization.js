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

export const AIR_MAX_PARTS = [
  { id: 'upper', label: 'Upper', material: 'UpperMaterial' },
  { id: 'laces', label: 'Laces', material: 'LacesMaterial' },
  { id: 'midsole', label: 'Midsole', material: 'MidsoleMaterial' },
]

export const SHOES = [
  {
    id: 'kickcraft-one',
    name: 'KickCraft One',
    summary: 'Original concept · 8 customizable parts',
    description: 'Our original customizable sneaker concept.',
    price: '₱4,890',
    image: '/images/kickcraft-one-card.png',
    src: '/models/shoe-soleview-final.glb',
    parts: PARTS,
    charmOffset: null,
    charmScale: '1 1 1',
    charmDir: null,
  },
  {
    id: 'nike-air-max',
    name: 'Nike Air Max',
    summary: 'Air Max model · 3 customizable parts',
    description: 'A 3D shoe with three simple customization zones.',
    price: '₱4,890',
    image: null,
    src: '/models/nike-air-max-custom.glb',
    parts: AIR_MAX_PARTS,
    charmOffset: '0.003800 0.005100 0.085800',
    charmScale: '0.25 0.25 0.25',
    charmDir: '/models/charms/air-max/',
  },
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

export function charmSource(charm, shoe) {
  if (!charm?.src || !shoe?.charmDir) return charm?.src || null
  return `${shoe.charmDir}${charm.src.split('/').pop()}`
}

export function charmScale(charmId, selectedCharmId, scale = '1 1 1') {
  return charmId === selectedCharmId ? scale : '0 0 0'
}
