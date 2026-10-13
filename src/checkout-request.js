const storageKey='kickcraft_checkout_request'
let pending=null
const validId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
export async function checkoutRequestId(body){
 const colors=Object.fromEntries(Object.entries(body.partColors||{}).sort(([a],[b])=>a.localeCompare(b)).map(([id,color])=>[id,color.value.trim().toLowerCase()]))
 const identity=JSON.stringify([body.customerName.trim(),body.email.trim().toLowerCase(),body.pickupDate,body.shoeId,body.size,body.charmId,colors])
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity))
 const fingerprint=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('')
 try{const stored=JSON.parse(localStorage.getItem(storageKey));if(stored?.fingerprint===fingerprint&&validId(stored.id))pending=stored}catch{}
 if(pending?.fingerprint===fingerprint&&validId(pending.id))return pending.id
 pending={fingerprint,id:crypto.randomUUID()}
 try{localStorage.setItem(storageKey,JSON.stringify(pending))}catch{}
 return pending.id
}
export function forgetCheckoutRequest(id){
 if(pending?.id===id)pending=null
 try{if(JSON.parse(localStorage.getItem(storageKey))?.id===id)localStorage.removeItem(storageKey)}catch{}
}
