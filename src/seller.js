export function validateStore(form) {

 for(const [key,min,max] of [['storeName',2,160],['pickupAddress',5,500],['description',0,3000],['contact',0,160]]) {

  const value=(form[key] || '').trim()

  if(value.length<min || value.length>max)return `${key} must contain ${min}–${max} characters.`

 }

 return ''

}

export function validateSeller(form) {

 if(!form.name?.trim() || form.name.trim().length<2 || form.name.length>160)return 'Enter your full name (2–160 characters).'

 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email || '') || form.email.length>254)return 'Enter a valid email address.'

 const length=new TextEncoder().encode(form.password || '').length

 if(length<10 || length>72)return 'Use a password of 10–72 bytes.'

 if(form.password!==form.confirmPassword)return 'Passwords must match.'

 return validateStore(form)

}

export function validateProduct(form) {

 if(!form.name?.trim() || form.name.trim().length<2 || form.name.length>160 || form.name==='Untitled shoe')return 'Add a product name (2–160 characters).'

 if(!form.description?.trim() || form.description.length>3000)return 'Describe the actual shoe (up to 3,000 characters).'

 if(!Number.isFinite(Number(form.price)) || Number(form.price)<=0 || Number(form.price)>1000000)return 'Set a valid price.'

 if(!Number.isInteger(Number(form.stock)) || Number(form.stock)<0 || Number(form.stock)>100000)return 'Set whole-number stock (0–100,000).'

 if(!Array.isArray(form.sizes) || !form.sizes.length || form.sizes.some(s=>!Number.isInteger(s) || s<5 || s>15))return 'Choose available US sizes (5–15).'

 if(!Array.isArray(form.parts) || form.parts.length<2 || form.parts.some(p=>!p.label?.trim() || p.label.length>80))return 'Name at least two customizable parts.'

 if(!Array.isArray(form.colors) || !form.colors.length || form.colors.length>32 || form.colors.some(c=>!c.name?.trim() || c.name.length>40 || !/^#[0-9a-f]{6}$/i.test(c.value)))return 'Add valid named palette colors.'

 return ''

}

export function publicCatalog(shoes,loaded,fallback) {return loaded?shoes:fallback}

export const pickupActions={pending:['approved','cancelled'],approved:['ready','cancelled'],ready:['completed','cancelled'],completed:[],cancelled:[]}

export const pickupLabels={pending:'Pending',approved:'Confirmed',ready:'Ready for pickup',completed:'Completed',cancelled:'Cancelled'}


export function palettePresets(palette) {
 if(!palette.length)return []
 return ['Studio palette','Alternate panels','Sole contrast'].map((name,offset)=>({name,colors:Array.from({length:Math.min(3,palette.length)},(_,i)=>palette[(i+offset)%palette.length])}))
}

export const productLabels={draft:'Private draft',pending:'Awaiting admin review',approved:'Approved — live in Shop',rejected:'Changes requested by admin'}
