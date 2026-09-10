// Part definitions — label/id are shared; material name is resolved per shoe below
export const PARTS = [
  { id: 'upper',        label: 'Upper' },
  { id: 'toe-cap',      label: 'Toe cap' },
  { id: 'tongue',       label: 'Tongue' },
  { id: 'laces',        label: 'Laces' },
  { id: 'heel-panel',   label: 'Heel panel' },
  { id: 'side-accents', label: 'Side accents' },
  { id: 'midsole',      label: 'Midsole' },
  { id: 'outsole',      label: 'Outsole' },
]

// Canonical material base names (PascalCase, matching the GLB mesh names)
const MATERIAL_BASES = ['Upper', 'ToeCap', 'Tongue', 'Laces', 'HeelPanel', 'SideAccents', 'Midsole', 'Outsole']

// Shoe catalog — add a new entry here when a new model is ready
export const SHOES = {
  one: {
    id: 'one',
    name: 'KickCraft One',
    subtitle: 'Our first original customizable sneaker concept.',
    price: '₱4,890',
    src: '/models/shoe-soleview-final.glb',
    // shoe-soleview-final.glb uses "UpperMaterial", "ToeCapMaterial", …
    materialName: (base) => `${base}Material`,
  },
  two: {
    id: 'two',
    name: 'KickCraft Two',
    subtitle: 'Eight-part customizable athletic silhouette with 3D charm anchor.',
    price: '₱4,890',
    src: '/models/shoe-kickcraft-ready.glb',
    // shoe-kickcraft-ready.glb uses plain "Upper", "ToeCap", …
    materialName: (base) => base,
  },
}

/**
 * Return the material name for a part within a given shoe.
 * @param {string} partId  – e.g. 'toe-cap'
 * @param {string} shoeId  – 'one' | 'two'
 */
export function materialName(partId, shoeId) {
  const idx = PARTS.findIndex(p => p.id === partId)
  if (idx === -1) return null
  const shoe = SHOES[shoeId]
  if (!shoe) return null
  return shoe.materialName(MATERIAL_BASES[idx])
}

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
